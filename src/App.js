import React, { useState, useEffect, useRef } from 'react';

// Resolve Backend API URL:
// 1. Check if backend_url is saved in localStorage
// 2. Fallback to process.env.REACT_APP_API_URL
// 3. Fallback to localhost:5001 if running on local dev port 3000
// 4. Fallback to window.location.origin
const getBackendUrl = () => {
  const saved = localStorage.getItem('backend_url');
  if (saved) return saved;

  let defaultUrl = process.env.REACT_APP_API_URL || 
    (window.location.port === '3000'
      ? `http://${window.location.hostname}:5001`
      : 'https://survey-hf6f.onrender.com');

  if (window.location.protocol === 'https:' && defaultUrl.startsWith('http://') && !defaultUrl.includes('localhost') && !defaultUrl.includes('127.0.0.1')) {
    defaultUrl = defaultUrl.replace('http://', 'https://');
  }
  return defaultUrl;
};

function App() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [loginNumber, setLoginNumber] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // API Configuration state
  const [apiUrl, setApiUrl] = useState(getBackendUrl());
  const [showApiSettings, setShowApiSettings] = useState(false);

  // Vercel auto-config detector
  const isVercelWithoutBackend = window.location.hostname.includes('vercel.app') && 
    !localStorage.getItem('backend_url') && 
    !process.env.REACT_APP_API_URL;

  // UI state
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, history
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Backend state (for active run)
  const [status, setStatus] = useState('idle'); // idle, running, stopping, completed, stopped, error
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentUrl, setCurrentUrl] = useState('');

  // Runs History state
  const [historyList, setHistoryList] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);

  // Form input fields state
  const [url, setUrl] = useState('');
  const [count, setCount] = useState(10);
  const [workers, setWorkers] = useState(3);
  const [headless, setHeadless] = useState(true);
  const [fastMode, setFastMode] = useState(true);

  const consoleEndRef = useRef(null);
  const pollingInterval = useRef(null);

  // Save API URL in state and localStorage
  const saveApiUrl = (newUrl) => {
    setApiUrl(newUrl);
    localStorage.setItem('backend_url', newUrl);
  };

  // Warn Vercel users to set API URL
  useEffect(() => {
    if (isVercelWithoutBackend) {
      setLoginError('Please configure your Render API Server URL first. (សូមកំណត់អាសយដ្ឋាន API Server របស់ Render ជាមុនសិន)');
      setShowApiSettings(true);
    } else {
      setLoginError('');
    }
  }, [isVercelWithoutBackend]);

  // Poll backend status
  const checkStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/status`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      
      setStatus(data.status);
      setSuccessCount(data.success);
      setFailCount(data.fail);
      setTotalCount(data.total);
      setLogs(data.logs || []);
      setElapsedTime(data.elapsed_time);
      setCurrentUrl(data.current_url);

      // If finished, stop polling
      if (data.status !== 'running' && data.status !== 'stopping') {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  // Start polling if running
  useEffect(() => {
    checkStatus();
    pollingInterval.current = setInterval(checkStatus, 1000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  // Auto scroll active logs console to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Fetch runs history from DB
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${apiUrl}/api/history`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setHistoryList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch logs of a specific history run
  const viewRunLogs = async (run) => {
    setSelectedRun(run);
    setHistoryLogs([]);
    try {
      const response = await fetch(`${apiUrl}/api/history/${run.id}/logs`);
      if (!response.ok) throw new Error('Failed to fetch run logs');
      const data = await response.json();
      setHistoryLogs(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle database login authentication
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch(`${apiUrl}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: loginNumber,
          password: loginPassword,
        }),
      });
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response from server. Make sure your API Server URL is correct.');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      setIsLoggedIn(true);
      localStorage.setItem('isLoggedIn', 'true');
      setLoginNumber('');
      setLoginPassword('');
    } catch (err) {
      if (
        err.message.includes('Failed to fetch') || 
        err.message.includes('fetch') || 
        err.message.includes('JSON') || 
        err.message.includes('response from server')
      ) {
        setLoginError('Connection failed. Please check if your API Server URL is correct. (មិនអាចភ្ជាប់ទៅកាន់ Server ទេ។ សូមពិនិត្យមើលអាសយដ្ឋាន API Server របស់អ្នក)');
        setShowApiSettings(true);
      } else {
        setLoginError(err.message || 'Connection failed.');
      }
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
  };

  // Start the bot
  const handleStart = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!url) {
      setErrorMessage('Please enter a Google Form URL (សូមបញ្ចូលតំណភ្ជាប់ Google Form)');
      return;
    }

    if (!url.includes('docs.google.com/forms')) {
      setErrorMessage('Invalid Google Form URL. Must start with docs.google.com/forms (តំណភ្ជាប់មិនត្រឹមត្រូវទេ)');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          count: parseInt(count),
          workers: parseInt(workers),
          headless,
          fast_mode: fastMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server error');
      }

      setSuccessMessage('Survey Bot started successfully! (កំពុងដំណើរការ)');
      
      // Start polling status
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      pollingInterval.current = setInterval(checkStatus, 1000);
      
    } catch (err) {
      setErrorMessage(err.message || 'Connection failed. Is the backend server running?');
    }
  };

  // Stop the bot
  const handleStop = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/stop`, {
        method: 'POST',
      });
      if (response.ok) {
        setSuccessMessage('Cancellation request sent! (បានផ្ញើរសំណើរបញ្ឈប់)');
      }
    } catch (err) {
      setErrorMessage('Failed to stop the bot.');
    }
  };

  // Active status progress calculations
  const totalSubmissions = successCount + failCount;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((totalSubmissions / totalCount) * 100)) : 0;
  const successRate = totalSubmissions > 0 ? Math.round((successCount / totalSubmissions) * 100) : 0;

  // Circular progress math
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // Render Login Lockscreen if not authenticated
  if (!isLoggedIn) {
    return (
      <div className="login-screen-wrapper">
        <div className="card login-card">
          <div className="login-logo">⚡</div>
          <div className="login-title">
            <h2>Authorized Login</h2>
            <span className="khmer-subtitle">សូមបញ្ចូលគណនីដើម្បីបន្ត</span>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="loginNumber">
                Number / Phone Number
                <span className="khmer-label">(លេខទូរស័ព្ទ)</span>
              </label>
              <input
                id="loginNumber"
                type="text"
                className="input-field"
                placeholder="e.g. 0972021149"
                value={loginNumber}
                onChange={(e) => setLoginNumber(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="loginPassword">
                Password
                <span className="khmer-label">(លេខកូដសម្ងាត់)</span>
              </label>
              <input
                id="loginPassword"
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            
            {loginError && (
              <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.8rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.9rem' }}>
                ⚠️ {loginError}
              </div>
            )}
            
            <button type="submit" className="action-button btn-start" style={{ marginTop: '0.5rem' }}>
              🔑 Log In (ចូលប្រព័ន្ធ)
            </button>
            
            {/* API settings link */}
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                onClick={() => setShowApiSettings(!showApiSettings)}
              >
                ⚙️ {showApiSettings ? 'Hide API Settings (លាក់ការកំណត់)' : 'Change API Server URL (ផ្លាស់ប្តូរ Server)'}
              </button>
            </div>
            
            {showApiSettings && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <label htmlFor="apiUrlInput" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Backend Server URL (អាសយដ្ឋាន API)
                </label>
                <input
                  id="apiUrlInput"
                  type="text"
                  className="input-field"
                  style={{ fontSize: '0.85rem', padding: '0.6rem 0.8rem', marginTop: '4px' }}
                  placeholder="https://your-app.onrender.com"
                  value={apiUrl}
                  onChange={(e) => saveApiUrl(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                  Enter your Render URL (ឧទាហរណ៍៖ https://survey-hf6f.onrender.com)
                </span>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, right: 0 }}>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            <span>🚪</span> Log Out (ចាកចេញ)
          </button>
        </div>
        <div className="logo-container">
          <div className="logo-icon">⚡</div>
          <h1>Auto Survey UI</h1>
        </div>
        <p className="subtitle">
          Submit responses automatically to Google Forms in parallel
          <span className="khmer-sub">ប្រព័ន្ធបំពេញសំណួរ Google Forms ដោយស្វ័យប្រវត្តិតាមអ៊ីនធឺណិត</span>
        </p>
      </header>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '2.5rem' }}>
        <button 
          type="button" 
          className={`btn-quick ${activeTab === 'dashboard' ? 'active' : ''}`}
          style={{ padding: '8px 24px', fontSize: '1rem', borderRadius: '12px' }}
          onClick={() => setActiveTab('dashboard')}
        >
          🚀 Bot Dashboard (ផ្ទាំងបញ្ជា)
        </button>
        <button 
          type="button" 
          className={`btn-quick ${activeTab === 'history' ? 'active' : ''}`}
          style={{ padding: '8px 24px', fontSize: '1rem', borderRadius: '12px' }}
          onClick={() => { setActiveTab('history'); fetchHistory(); }}
        >
          📂 Run History (ប្រវត្តិដំណើរការ)
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="dashboard-grid">
          {/* Configuration Card */}
          <div className="card">
            <div className="card-title">
              <span>⚙️ Configuration</span>
              <span className="khmer-text">ការកំណត់រចនាសម្ព័ន្ធ</span>
            </div>

            <form onSubmit={handleStart}>
              <div className="form-group">
                <label htmlFor="url">
                  Google Form Link
                  <span className="khmer-label">(តំណភ្ជាប់ Google Form)</span>
                </label>
                <input
                  id="url"
                  type="text"
                  className="input-field"
                  placeholder="https://docs.google.com/forms/d/.../viewform"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={status === 'running' || status === 'stopping'}
                />
              </div>

              <div className="form-group">
                <label htmlFor="count">
                  Target Responses Count
                  <span className="khmer-label">(ចំនួនចម្លើយចង់បាន)</span>
                </label>
                <input
                  id="count"
                  type="number"
                  min="1"
                  max="1000"
                  className="input-field"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  disabled={status === 'running' || status === 'stopping'}
                />
                <div className="quick-buttons">
                  {[10, 50, 100, 200].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`btn-quick ${count === num ? 'active' : ''}`}
                      onClick={() => setCount(num)}
                      disabled={status === 'running' || status === 'stopping'}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <button
                type="button"
                className={`advanced-toggle ${showAdvanced ? 'open' : ''}`}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6" />
                </svg>
                Advanced Concurrency Settings
              </button>

              {showAdvanced && (
                <div className="advanced-content">
                  <div className="settings-grid">
                    <div className="form-group">
                      <label htmlFor="workers">
                        Parallel Browsers (Threads)
                        <span className="khmer-label">(ដំណើរការស្របគ្នា)</span>
                      </label>
                      <input
                        id="workers"
                        type="number"
                        min="1"
                        max="10"
                        className="input-field"
                        value={workers}
                        onChange={(e) => setWorkers(e.target.value)}
                        disabled={status === 'running' || status === 'stopping'}
                      />
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="toggle-container" onClick={() => status !== 'running' && status !== 'stopping' && setHeadless(!headless)}>
                        <div className="toggle-label">
                          <span>Headless Mode</span>
                          <span className="toggle-sub">លាក់ផ្ទាំង Chrome</span>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={headless}
                            onChange={() => {}}
                            disabled={status === 'running' || status === 'stopping'}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div className="toggle-container" onClick={() => status !== 'running' && status !== 'stopping' && setFastMode(!fastMode)}>
                        <div className="toggle-label">
                          <span>Instant Click (Fast)</span>
                          <span className="toggle-sub">ចុចលឿនបំផុត</span>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={fastMode}
                            onChange={() => {}}
                            disabled={status === 'running' || status === 'stopping'}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings and messages */}
              {errorMessage && (
                <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.8rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.9rem' }}>
                  ⚠️ {errorMessage}
                </div>
              )}
              {successMessage && (
                <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.8rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.9rem' }}>
                  ✅ {successMessage}
                </div>
              )}

              {/* Launch actions */}
              {status === 'running' || status === 'stopping' ? (
                <button
                  type="button"
                  className="action-button btn-stop"
                  onClick={handleStop}
                  disabled={status === 'stopping'}
                >
                  🛑 Stop Submission (បញ្ឈប់ដំណើរការ)
                </button>
              ) : (
                <button
                  type="submit"
                  className="action-button btn-start"
                >
                  ⚡ Start Submitting (ចាប់ផ្តើមដំណើរការ)
                </button>
              )}
            </form>
          </div>

          {/* Active status diagnostics */}
          <div className="card">
            <div className="card-title">
              <span>📊 Live Status</span>
              <span className="khmer-text">ស្ថានភាពបច្ចុប្បន្ន</span>
              <div style={{ marginLeft: 'auto' }}>
                <span className={`status-badge badge-${status}`}>
                  {status === 'idle' && 'Idle'}
                  {status === 'running' && 'Running'}
                  {status === 'stopping' && 'Stopping'}
                  {status === 'completed' && 'Completed'}
                  {status === 'stopped' && 'Stopped'}
                  {status === 'error' && 'Error'}
                </span>
              </div>
            </div>

            {currentUrl && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', wordBreak: 'break-all', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                🔗 <strong>Form:</strong> {currentUrl}
              </div>
            )}

            <div className="progress-section">
              <div className="progress-circle-wrapper">
                <svg width="160" height="160" viewBox="0 0 160 160">
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                  <circle cx="80" cy="80" r={radius} className="progress-circle-bg" />
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    className="progress-circle-bar"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 80 80)"
                  />
                </svg>
                <div className="progress-value">
                  <div className="progress-percentage">{progressPercent}%</div>
                  <div className="progress-label">completed</div>
                </div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-val success">{successCount}</div>
                <div className="stat-lbl">
                  Success
                  <span className="khmer-lbl">ជោគជ័យ</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-val fail">{failCount}</div>
                <div className="stat-lbl">
                  Failed
                  <span className="khmer-lbl">បរាជ័យ</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-val" style={{ color: '#818cf8' }}>
                  {totalSubmissions}/{totalCount}
                </div>
                <div className="stat-lbl">
                  Total Submitted
                  <span className="khmer-lbl">សរុបសម្រេច</span>
                </div>
              </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '-12px' }}>
              <div className="stat-item">
                <div className="stat-val" style={{ color: '#38bdf8' }}>{elapsedTime}s</div>
                <div className="stat-lbl">
                  Elapsed Time
                  <span className="khmer-lbl">រយៈពេលចំណាយ</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-val" style={{ color: '#c084fc' }}>{successRate}%</div>
                <div className="stat-lbl">
                  Success Rate
                  <span className="khmer-lbl">អត្រាជោគជ័យ</span>
                </div>
              </div>
            </div>

            {/* Scrolling console logs */}
            <div className="console-wrapper">
              <div className="console-header">
                <div className="console-title">
                  <span className={`console-dot ${status !== 'running' ? 'inactive' : ''}`}></span>
                  Live Terminal Console logs
                </div>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                  onClick={() => setLogs([])}
                >
                  [Clear]
                </button>
              </div>
              <div className="console-content">
                {logs.length === 0 ? (
                  <div className="console-empty">
                    Console is idle. Launch task to stream logs.
                  </div>
                ) : (
                  logs.map((log, index) => {
                    let logClass = '';
                    if (log.includes('✅') || log.includes('ជោគជ័យ')) logClass = 'success';
                    else if (log.includes('❌') || log.includes('ERROR') || log.includes('បរាជ័យ')) logClass = 'error';
                    else if (log.includes('⚠️') || log.includes('🛑')) logClass = 'warning';

                    return (
                      <div key={index} className={`log-line ${logClass}`}>
                        {log}
                      </div>
                    );
                  })
                )}
                <div ref={consoleEndRef} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
          {/* History runs list */}
          <div className="card">
            <div className="card-title">
              <span>📂 Survey Run History</span>
              <span className="khmer-text">ប្រវត្តិនៃការរត់បំពេញសំណួរ</span>
              <button 
                type="button" 
                className="btn-quick" 
                style={{ padding: '6px 14px', fontSize: '0.85rem', marginLeft: 'auto', borderRadius: '8px' }}
                onClick={fetchHistory}
              >
                🔄 Refresh
              </button>
            </div>

            {isLoadingHistory ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                🔄 Loading history records from database...
              </div>
            ) : historyList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                📭 No run history found in database. Execute runs to populate lists here.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '650px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '12px' }}>Created Date</th>
                      <th style={{ padding: '12px' }}>Form URL</th>
                      <th style={{ padding: '12px' }}>Success / Total</th>
                      <th style={{ padding: '12px' }}>Success Rate</th>
                      <th style={{ padding: '12px' }}>Duration</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((run) => {
                      const rate = run.total_count > 0 ? Math.round((run.success_count / run.total_count) * 100) : 0;
                      return (
                        <tr key={run.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{run.created_at}</td>
                          <td style={{ padding: '12px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={run.url}>
                            {run.url}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>{run.success_count}</span>
                            <span style={{ color: 'var(--text-muted)' }}> / {run.total_count}</span>
                          </td>
                          <td style={{ padding: '12px', color: '#c084fc', fontWeight: '600' }}>{rate}%</td>
                          <td style={{ padding: '12px' }}>{run.elapsed_time}s</td>
                          <td style={{ padding: '12px' }}>
                            <span className={`status-badge badge-${run.status}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                              {run.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <button 
                              type="button" 
                              className="btn-quick" 
                              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                              onClick={() => viewRunLogs(run)}
                            >
                              👁️ View Logs
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detailed logs popup for selected run */}
          {selectedRun && (
            <div className="card" style={{ background: '#03040b', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
              <div className="card-title" style={{ paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ color: '#a5b4fc', fontSize: '1.05rem' }}>
                  📋 Logs for Run #{selectedRun.id} (Date: {selectedRun.created_at})
                </span>
                <button 
                  type="button" 
                  className="btn-quick" 
                  style={{ padding: '4px 10px', fontSize: '0.8rem', marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
                  onClick={() => setSelectedRun(null)}
                >
                  Close logs (បិទ)
                </button>
              </div>
              <div style={{ height: '300px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', lineHeight: '1.6', color: '#cbd5e1', padding: '1rem', background: 'rgba(0,0,0,0.6)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                {historyLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '3.5rem' }}>
                    No logs recorded for this run.
                  </div>
                ) : (
                  historyLogs.map((log) => {
                    let logClass = '';
                    if (log.message.includes('✅') || log.message.includes('ជោគជ័យ')) logClass = 'success';
                    else if (log.message.includes('❌') || log.message.includes('ERROR') || log.message.includes('បរាជ័យ')) logClass = 'error';
                    else if (log.message.includes('⚠️') || log.message.includes('🛑')) logClass = 'warning';

                    return (
                      <div key={log.id} className={`log-line ${logClass}`} style={{ marginBottom: '4px' }}>
                        [{log.timestamp}] {log.message}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
