import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, Terminal, Activity, Trash2, RotateCcw, 
  Search, Sparkles, Key, CheckCircle, AlertTriangle, ExternalLink, 
  Settings, ChevronDown, ChevronUp, Copy, Check, ArrowDown, 
  Lock, Unlock, Shield, LogOut, ArrowLeft, RefreshCw, Zap,
  Database, UserCheck, Bug, CheckSquare, Edit3, X, Filter, Eye, Target, Camera
} from 'lucide-react';

export default function AdminPanel({ 
  status, 
  onRefreshStatus, 
  onRefreshChecks, 
  onBackToPublic,
  onEditCheck,
  onPlayItem
}) {
  const [token, setToken] = useState(() => localStorage.getItem('budicheck_admin_token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Active top tab: 'checks' (Visszaellenőrzés), 'reports' (Hibabejelentések), 'system' (Kereső & Beállítások)
  const [activeTab, setActiveTab] = useState('checks');

  // Login form
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeMsg, setPasswordChangeMsg] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);

  // Checks management / Visszaellenőrzés
  const [checksList, setChecksList] = useState([]);
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [checksFilter, setChecksFilter] = useState('all'); // 'all', 'verified', 'unverified', 'warning', 'rejected'
  const [checksSearch, setChecksSearch] = useState('');
  const [runningBatchAudit, setRunningBatchAudit] = useState(false);
  const [auditingCheckId, setAuditingCheckId] = useState(null);
  const [syncingCheckId, setSyncingCheckId] = useState(null);

  // Reports management
  const [reportsList, setReportsList] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportsFilter, setReportsFilter] = useState('all'); // 'all', 'open', 'resolved'

  // Scanner controls (Indie Horror playlist has 226 videos)
  const [maxVideos, setMaxVideos] = useState(226);
  const [playlistUrl, setPlaylistUrl] = useState('https://youtube.com/playlist?list=PL-0aMuV87MLWOwH9PLKO1EBYStLmIKScV');
  const [showPlaylistInput, setShowPlaylistInput] = useState(false);
  const [singleUrl, setSingleUrl] = useState('');
  const [logFilter, setLogFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const consoleEndRef = useRef(null);

  // Gemini AI configuration
  const [config, setConfig] = useState({
    has_gemini_api_key: false,
    masked_api_key: '',
    model_name: 'gemini-3.5-flash-lite',
    use_gemini: true
  });
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash-lite');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState(null);
  const [modelsList, setModelsList] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const isRunning = status.status === 'running';
  const isPaused = status.status === 'paused';
  const total = status.total_channel_videos || 1;
  const processed = status.processed_count || 0;
  const progressPct = Math.min(100, Math.round((processed / total) * 100));

  // Verify auth on mount or token change
  useEffect(() => {
    checkAuth(token);
  }, [token]);

  const checkAuth = async (testToken) => {
    if (!testToken) {
      setIsAuthenticated(false);
      setCheckingAuth(false);
      return;
    }
    try {
      setCheckingAuth(true);
      const res = await fetch('/api/admin/check', {
        headers: { 'x-admin-token': testToken }
      });
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(Boolean(data.authenticated));
        if (data.authenticated) {
          fetchConfig(testToken);
          fetchModels(false, testToken);
          fetchAdminChecks();
          fetchReports(testToken);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('budicheck_admin_token', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
        setLoginPassword('');
        window.dispatchEvent(new Event('budicheck_auth_changed'));
        fetchConfig(data.token);
        fetchModels(false, data.token);
        fetchAdminChecks();
        fetchReports(data.token);
        onRefreshStatus();
      } else {
        const err = await res.json();
        setLoginError(err.detail || 'Helytelen adminisztrátori jelszó!');
      }
    } catch (e) {
      setLoginError('Nem sikerült kapcsolatot létesíteni a szerverrel.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'x-admin-token': token }
      });
    } catch (e) {}
    localStorage.removeItem('budicheck_admin_token');
    setToken('');
    setIsAuthenticated(false);
    window.dispatchEvent(new Event('budicheck_auth_changed'));
    if (onBackToPublic) {
      onBackToPublic();
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordChangeMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordChangeMsg({ type: 'error', text: 'Az új jelszavak nem egyeznek meg!' });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });
      if (res.ok) {
        setPasswordChangeMsg({ type: 'success', text: 'Admin jelszó sikeresen megváltoztatva!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setShowPasswordModal(false), 1600);
      } else {
        const err = await res.json();
        setPasswordChangeMsg({ type: 'error', text: err.detail || 'Hiba a jelszó módosításakor.' });
      }
    } catch (e) {
      setPasswordChangeMsg({ type: 'error', text: 'Hálózati hiba a kérés közben.' });
    } finally {
      setChangingPassword(false);
    }
  };

  // CHECKS MANAGEMENT METHODS
  const fetchAdminChecks = async () => {
    setLoadingChecks(true);
    try {
      const res = await fetch('/api/checks?sort_by=newest&all_status=true', {
        headers: token ? { 'x-admin-token': token } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setChecksList(data.items || []);
      }
    } catch (e) {
      console.error('Failed to fetch checks for admin:', e);
    } finally {
      setLoadingChecks(false);
    }
  };

  const handleVerifyCheck = async (checkId, targetStatus) => {
    try {
      const res = await fetch(`/api/checks/${checkId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        },
        body: JSON.stringify({ is_verified: targetStatus })
      });
      if (res.ok) {
        setChecksList(prev => prev.map(c => c.id === checkId ? { ...c, is_verified: targetStatus } : c));
        onRefreshChecks();
      }
    } catch (e) {
      alert('Hiba történt a jóváhagyás során.');
    }
  };

  const handleDeleteCheck = async (checkId, promptConfirm = true) => {
    if (promptConfirm && !window.confirm('Biztosan véglegesen törölni szeretnéd ezt a budi kártyát? Ez eltávolítja a rangsorból és a kvízből is.')) {
      return;
    }
    try {
      const res = await fetch(`/api/checks/${checkId}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token }
      });
      if (res.ok) {
        setChecksList(prev => prev.filter(c => c.id !== checkId));
        // Also update local reports list
        setReportsList(prev => prev.map(r => r.check_id === checkId ? { ...r, status: 'resolved' } : r));
        onRefreshChecks();
        onRefreshStatus();
      } else {
        alert('Nem sikerült törölni a kártyát.');
      }
    } catch (e) {
      alert('Hálózati hiba a kártya törlésekor.');
    }
  };

  // AUTOMATED AI AUDIT HANDLERS
  const handleRunBatchAudit = async () => {
    if (!window.confirm('Elindítod az Automata AI Visszaellenőrzést? A Gemini AI minden rögzített kártyát átvizsgál, ellenőrzi a játéknév helyességét, a pontszámot és a budi érvényességét.')) {
      return;
    }
    setRunningBatchAudit(true);
    try {
      const res = await fetch('/api/admin/audit/run', {
        method: 'POST',
        headers: { 'x-admin-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        alert(`🎉 Automata audit befejezve!\n✅ Igazolt budik: ${data.verified}\n⚠️ Kérdéses esetek: ${data.warnings}\n❌ Fals találatok: ${data.rejected}`);
        fetchAdminChecks();
        onRefreshChecks();
        onRefreshStatus();
      } else {
        alert('Hiba történt az automata visszaellenőrzés során.');
      }
    } catch (e) {
      alert('Hálózati hiba az automata visszaellenőrzéskor.');
    } finally {
      setRunningBatchAudit(false);
    }
  };

  const handleAuditSingleCheck = async (checkId) => {
    setAuditingCheckId(checkId);
    try {
      const res = await fetch(`/api/admin/audit/${checkId}`, {
        method: 'POST',
        headers: { 'x-admin-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setChecksList(prev => prev.map(c => c.id === checkId ? data.item : c));
          onRefreshChecks();
        }
      } else {
        alert('Nem sikerült az egyedi auditálás.');
      }
    } catch (e) {
      alert('Hálózati hiba.');
    } finally {
      setAuditingCheckId(null);
    }
  };

  const handleSyncCheckTimestamp = async (checkId) => {
    setSyncingCheckId(checkId);
    try {
      const res = await fetch(`/api/checks/${checkId}/sync-timestamp`, {
        method: 'POST',
        headers: { 'x-admin-token': token }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'Időpont sikeresen szinkronizálva!');
        fetchAdminChecks();
        onRefreshChecks();
        onRefreshStatus();
      } else {
        alert(data.detail || 'Nem sikerült az idézetet megtalálni a feliratban.');
      }
    } catch (e) {
      alert('Hálózati hiba az időpont szinkronizálásakor.');
    } finally {
      setSyncingCheckId(null);
    }
  };

  const [resnapshottingId, setResnapshottingId] = useState(null);

  const handleResnapshotAdmin = async (checkId, offsetSec = 0) => {
    setResnapshottingId(checkId);
    try {
      const res = await fetch(`/api/checks/${checkId}/resnapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        },
        body: JSON.stringify({
          offset_sec: offsetSec,
          force: true
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChecksList(prev => prev.map(c => c.id === checkId ? { ...data.item, screenshot_url: `${data.screenshot_url}?t=${Date.now()}` } : c));
        onRefreshChecks();
      } else {
        alert(data.detail || 'Nem sikerült újraképkockázni a videót.');
      }
    } catch (e) {
      alert('Hálózati hiba az újraképkockázás közben.');
    } finally {
      setResnapshottingId(null);
    }
  };

  const handleCleanRejected = async () => {
    if (!window.confirm('Biztosan törölni szeretnéd az összes olyan kártyát, amit az AI Fals találatként (rejected) jelölt meg?')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/audit/clean-rejected', {
        method: 'POST',
        headers: { 'x-admin-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Sikeres törlés! ${data.deleted_count} db fals budi kártya eltávolítva.`);
        fetchAdminChecks();
        onRefreshChecks();
        onRefreshStatus();
      }
    } catch (e) {
      alert('Hiba a fals kártyák törlésekor.');
    }
  };

  // REPORTS MANAGEMENT METHODS
  const fetchReports = async (currToken = token) => {
    if (!currToken) return;
    setLoadingReports(true);
    try {
      const res = await fetch('/api/admin/reports', {
        headers: { 'x-admin-token': currToken }
      });
      if (res.ok) {
        const data = await res.json();
        setReportsList(data.items || []);
      }
    } catch (e) {
      console.error('Failed to fetch reports:', e);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleUpdateReportStatus = async (reportId, newStatus) => {
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setReportsList(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
        onRefreshStatus();
      }
    } catch (e) {
      alert('Hiba a jelentés státuszának frissítésekor.');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a bejelentést?')) return;
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token }
      });
      if (res.ok) {
        setReportsList(prev => prev.filter(r => r.id !== reportId));
        onRefreshStatus();
      }
    } catch (e) {
      alert('Hiba a jelentés törlésekor.');
    }
  };

  const handleDeleteFromReport = async (checkId, reportId) => {
    if (!window.confirm('Biztosan törlöd a bejelentett fals budi kártyát? A kártya véglegesen törlődik és a hibabejelentés automatikusan lezárul.')) {
      return;
    }
    await handleDeleteCheck(checkId, false);
    await handleUpdateReportStatus(reportId, 'resolved');
    alert('A kártya sikeresen törölve, a hibabejelentés lezárva!');
  };

  // CONFIG & AI
  const fetchConfig = async (activeTok = token) => {
    try {
      const res = await fetch('/api/config', {
        headers: { 'x-admin-token': activeTok }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        if (data.model_name) {
          setSelectedModel(data.model_name);
        }
      }
    } catch (e) {
      console.error('Failed to load Gemini config:', e);
    }
  };

  const fetchModels = async (forceRefresh = false, activeTok = token) => {
    try {
      setLoadingModels(true);
      const res = await fetch(`/api/models?refresh=${forceRefresh}`, {
        headers: { 'x-admin-token': activeTok }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          setModelsList(data.models);
        }
      }
    } catch (e) {
      console.error('Failed to fetch Gemini models quota:', e);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigFeedback(null);
    try {
      const payload = {
        model_name: selectedModel,
        use_gemini: true
      };
      if (apiKeyInput.trim()) {
        payload.gemini_api_key = apiKeyInput.trim();
      }
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': token
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setConfigFeedback({ type: 'success', text: data.message });
        setApiKeyInput('');
        fetchConfig();
        fetchModels(true);
        onRefreshStatus();
      } else {
        const err = await res.json();
        setConfigFeedback({ type: 'error', text: err.detail || 'Mentési hiba' });
      }
    } catch (e) {
      setConfigFeedback({ type: 'error', text: 'Nem sikerült a kapcsolat a szerverrel.' });
    } finally {
      setSavingConfig(false);
    }
  };

  // Scanner actions
  const handleStart = async (incremental = false) => {
    let url = `/api/scanner/start?max_videos=${maxVideos}&incremental=${incremental}`;
    if (playlistUrl) {
      url += `&playlist_url=${encodeURIComponent(playlistUrl)}`;
    }
    await fetch(url, { 
      method: 'POST',
      headers: { 'x-admin-token': token }
    });
    onRefreshStatus();
  };

  const handlePause = async () => {
    await fetch('/api/scanner/pause', { 
      method: 'POST',
      headers: { 'x-admin-token': token }
    });
    onRefreshStatus();
  };

  const handleStop = async () => {
    await fetch('/api/scanner/stop', { 
      method: 'POST',
      headers: { 'x-admin-token': token }
    });
    onRefreshStatus();
  };

  const handleClearLogs = async () => {
    await fetch('/api/logs/clear', { 
      method: 'POST',
      headers: { 'x-admin-token': token }
    });
    onRefreshStatus();
  };

  const handleSingleScan = async (e) => {
    e.preventDefault();
    if (!singleUrl.trim()) return;
    try {
      const res = await fetch('/api/scanner/scan_single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        },
        body: JSON.stringify({ video_url: singleUrl.trim() })
      });
      if (res.ok) {
        setSingleUrl('');
        onRefreshStatus();
        fetchAdminChecks();
        onRefreshChecks();
      } else {
        const err = await res.json();
        alert(err.detail || 'Nem sikerült az egyedi videó ellenőrzése.');
      }
    } catch (e) {
      alert('Hálózati hiba történt.');
    }
  };

  const handleResetVotes = async () => {
    if (window.confirm('Biztosan nullázni szeretnéd a felhasználói közösségi szavazatokat és átlagokat? A mentett budi adatok nem vesznek el.')) {
      await fetch('/api/scanner/reset-votes', {
        method: 'POST',
        headers: { 'x-admin-token': token }
      });
      onRefreshStatus();
      fetchAdminChecks();
      onRefreshChecks();
      alert('Közösségi szavazatok sikeresen nullázva!');
    }
  };

  const handleResetHistory = async () => {
    if (window.confirm('Biztosan nullázni szeretnéd az eddig átvizsgált videók listáját? Ez lehetővé teszi a videók újbóli átnézését anélkül, hogy törölné a már megtalált budikat.')) {
      await fetch('/api/scanner/reset-history', {
        method: 'POST',
        headers: { 'x-admin-token': token }
      });
      onRefreshStatus();
      alert('Szkennelt videó történet nullázva!');
    }
  };

  const handleFullReset = async () => {
    if (window.confirm('⚠️ FIGYELEM: Biztosan TELJES ALAPHELYZETBE állítod az adatbázist? Minden talált budi, képernyőkép, szavazat és videó feldolgozási lista véglegesen törlődik!')) {
      await fetch('/api/scanner/reset', {
        method: 'POST',
        headers: { 'x-admin-token': token }
      });
      onRefreshStatus();
      fetchAdminChecks();
      fetchReports();
      onRefreshChecks();
      alert('Teljes adatbázis alaphelyzetbe állítva!');
    }
  };

  const rawLogs = status.logs || [];
  const filteredLogs = rawLogs.filter((l) => {
    if (logFilter === 'match') return l.level === 'match' || l.level === 'snapshot' || l.level === 'success';
    if (logFilter === 'warning') return l.level === 'warning' || l.level === 'skip';
    return true;
  });

  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollTop = consoleEndRef.current.scrollHeight;
    }
  }, [rawLogs, autoScroll]);

  const copyLogs = () => {
    const text = rawLogs.map((l) => `[${l.time}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter checks in verification tab
  const displayedChecks = checksList.filter(c => {
    if (checksFilter === 'unverified' && c.is_verified) return false;
    if (checksFilter === 'verified' && !c.is_verified) return false;
    if (checksFilter === 'warning' && c.audit_status !== 'warning') return false;
    if (checksFilter === 'rejected' && c.audit_status !== 'rejected') return false;
    if (checksSearch.trim()) {
      const q = checksSearch.toLowerCase();
      const matchGame = (c.game_title || '').toLowerCase().includes(q);
      const matchVid = (c.video_title || '').toLowerCase().includes(q);
      const matchQuote = (c.quote || '').toLowerCase().includes(q);
      if (!matchGame && !matchVid && !matchQuote) return false;
    }
    return true;
  });

  // Filter reports in reports tab
  const displayedReports = reportsList.filter(r => {
    if (reportsFilter === 'open' && r.status !== 'open') return false;
    if (reportsFilter === 'resolved' && r.status !== 'resolved') return false;
    return true;
  });

  const openReportsCount = reportsList.filter(r => r.status === 'open').length;
  const unverifiedChecksCount = checksList.filter(c => !c.is_verified).length;
  const verifiedChecksCount = checksList.filter(c => c.is_verified).length;
  const warningChecksCount = checksList.filter(c => c.audit_status === 'warning').length;
  const rejectedChecksCount = checksList.filter(c => c.audit_status === 'rejected').length;

  if (checkingAuth) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
        <RefreshCw className="spin" size={32} style={{ color: 'var(--accent-cyan)' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Adminisztrátori jogosultság ellenőrzése...</p>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="container" style={{ maxWidth: '480px', margin: '4rem auto' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(157, 78, 221, 0.2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            border: '1px solid var(--border-glow)'
          }}>
            <Shield size={32} style={{ color: 'var(--accent-cyan)' }} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem', color: '#fff' }}>
            Adminisztrátori Belépés
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            A TheVR Jani BudiCheck archívum és rangsor karbantartásához kérlek add meg az admin jelszót.
          </p>

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={15} style={{ color: 'var(--accent-cyan)' }} />
                <span>Admin Jelszó</span>
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Admin jelszó megadása..."
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoFocus
                required
                style={{ fontSize: '1.05rem', padding: '0.85rem' }}
              />
            </div>

            {loginError && (
              <div style={{ 
                background: 'rgba(255, 77, 109, 0.15)', 
                border: '1px solid var(--accent-red)', 
                color: 'var(--accent-red)', 
                padding: '0.75rem', 
                borderRadius: '8px', 
                fontSize: '0.85rem', 
                marginBottom: '1.5rem' 
              }}>
                {loginError}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loggingIn}
              style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}
            >
              <Unlock size={18} />
              <span>{loggingIn ? 'Hitelesítés...' : 'Belépés az Irányítópultra'}</span>
            </button>
          </form>

          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={onBackToPublic}
            >
              <ArrowLeft size={16} />
              <span>Vissza a Publikus Archívumhoz</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AUTHENTICATED ADMIN DASHBOARD
  return (
    <div className="container" style={{ margin: '2rem auto 4rem' }}>
      {/* ADMIN HEADER BAR */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid var(--accent-cyan)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
              TheVR Jani BudiCheck <span style={{ color: 'var(--accent-cyan)' }}>Admin Irányítópult</span>
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Kártyák visszaellenőrzése, törlés, hibabejelentések kezelése és rendszer karbantartás
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowPasswordModal(true)}
            style={{ fontSize: '0.85rem' }}
          >
            <Key size={15} />
            <span>Jelszó Módosítása</span>
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={onBackToPublic}
            style={{ fontSize: '0.85rem' }}
          >
            <ArrowLeft size={15} />
            <span>Főoldal</span>
          </button>

          <button 
            className="btn btn-danger" 
            onClick={handleLogout}
            style={{ fontSize: '0.85rem' }}
          >
            <LogOut size={15} />
            <span>Kijelentkezés</span>
          </button>
        </div>
      </div>

      {/* TOP NAVIGATION TABS */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.75rem',
        background: 'rgba(0, 0, 0, 0.45)',
        padding: '6px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap'
      }}>
        <button
          className={`btn ${activeTab === 'checks' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('checks'); fetchAdminChecks(); }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.1rem', fontWeight: 700 }}
        >
          <Search size={16} />
          <span>🔍 Visszaellenőrzés & Budik Kezelése</span>
          <span style={{
            background: activeTab === 'checks' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.1)',
            padding: '2px 7px',
            borderRadius: '10px',
            fontSize: '0.75rem'
          }}>
            {checksList.length}
          </span>
          {unverifiedChecksCount > 0 && (
            <span style={{
              background: 'rgba(255, 183, 3, 0.25)',
              color: 'var(--accent-gold)',
              border: '1px solid var(--accent-gold)',
              padding: '1px 6px',
              borderRadius: '8px',
              fontSize: '0.7rem'
            }}>
              {unverifiedChecksCount} új
            </span>
          )}
        </button>

        <button
          className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('reports'); fetchReports(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.6rem 1.1rem',
            fontWeight: 700,
            borderColor: openReportsCount > 0 ? 'rgba(255, 77, 109, 0.5)' : undefined
          }}
        >
          <Bug size={16} style={{ color: openReportsCount > 0 ? '#ff4d6d' : undefined }} />
          <span>🚨 Hibabejelentések</span>
          {openReportsCount > 0 ? (
            <span style={{
              background: 'var(--accent-red)',
              color: '#fff',
              padding: '2px 7px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 800
            }}>
              {openReportsCount} ÚJ
            </span>
          ) : (
            <span style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '2px 7px',
              borderRadius: '10px',
              fontSize: '0.75rem'
            }}>
              {reportsList.length}
            </span>
          )}
        </button>

        <button
          className={`btn ${activeTab === 'system' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('system')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.1rem', fontWeight: 700 }}
        >
          <Settings size={16} />
          <span>⚙️ Kereső & Rendszer Beállítások</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VISSZAELLENŐRZÉS & BUDIK KEZELÉSE */}
      {/* ========================================================================= */}
      {activeTab === 'checks' && (
        <div>
          {/* STATS & FILTER BAR */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Budi Kártyák Visszaellenőrzése & Törlése</span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  A Gemini AI automatikusan átvizsgálja a kártyákat: igazolja a valódi budikat, javítja a játékneveket, és kiszűri a fals találatokat!
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={handleRunBatchAudit}
                  disabled={runningBatchAudit || loadingChecks}
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #06d6a0, #00f2fe)' }}
                  title="A Gemini AI egy kattintással átvizsgálja az összes kártyát"
                >
                  <Sparkles size={15} className={runningBatchAudit ? 'spin' : ''} />
                  <span>{runningBatchAudit ? 'Automata AI Auditálás Folyamatban...' : '🤖 Automata AI Visszaellenőrzés'}</span>
                </button>

                {rejectedChecksCount > 0 && (
                  <button 
                    className="btn btn-danger" 
                    onClick={handleCleanRejected}
                    style={{ fontSize: '0.85rem' }}
                    title="Az összes fals találatnak minősített kártya végleges törlése"
                  >
                    <Trash2 size={15} />
                    <span>Fals találatok törlése ({rejectedChecksCount} db)</span>
                  </button>
                )}

                <button 
                  className="btn btn-secondary" 
                  onClick={fetchAdminChecks}
                  disabled={loadingChecks}
                  style={{ fontSize: '0.85rem' }}
                >
                  <RefreshCw size={14} className={loadingChecks ? 'spin' : ''} />
                  <span>Frissítés</span>
                </button>
              </div>
            </div>

            {/* FILTERS & SEARCH */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  className={`btn ${checksFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                  onClick={() => setChecksFilter('all')}
                >
                  Összes ({checksList.length})
                </button>
                <button
                  className={`btn ${checksFilter === 'verified' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                  onClick={() => setChecksFilter('verified')}
                >
                  ✅ Igazolt ({verifiedChecksCount})
                </button>
                <button
                  className={`btn ${checksFilter === 'unverified' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                  onClick={() => setChecksFilter('unverified')}
                >
                  ⏳ Függőben ({unverifiedChecksCount})
                </button>
                {warningChecksCount > 0 && (
                  <button
                    className={`btn ${checksFilter === 'warning' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem', color: 'var(--accent-gold)' }}
                    onClick={() => setChecksFilter('warning')}
                  >
                    ⚠️ Kérdéses ({warningChecksCount})
                  </button>
                )}
                {rejectedChecksCount > 0 && (
                  <button
                    className={`btn ${checksFilter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem', color: 'var(--accent-red)' }}
                    onClick={() => setChecksFilter('rejected')}
                  >
                    ❌ Fals Találat ({rejectedChecksCount})
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
                  placeholder="Keresés játék, videó vagy idézet szerint..."
                  value={checksSearch}
                  onChange={(e) => setChecksSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* CHECKS LIST */}
          {loadingChecks ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <RefreshCw className="spin" size={32} style={{ color: 'var(--accent-cyan)' }} />
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Budik betöltése...</p>
            </div>
          ) : displayedChecks.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚽</div>
              <h4 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '0.3rem' }}>
                Nincs a szűrésnek megfelelő budi kártya
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Próbáld meg módosítani a keresési feltételt vagy a státusz szűrőt.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {displayedChecks.map((item) => (
                <div 
                  key={item.id}
                  className="glass-panel"
                  style={{
                    padding: '1rem 1.25rem',
                    borderLeft: item.audit_status === 'rejected'
                      ? '4px solid var(--accent-red)'
                      : (item.is_verified
                          ? '4px solid var(--accent-green)'
                          : (item.audit_status === 'warning'
                              ? '4px solid var(--accent-gold)'
                              : '4px solid var(--border-color)')),
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}
                >
                  {/* Left: Thumbnail & basic info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 450px', minWidth: 0 }}>
                    <div 
                      style={{ position: 'relative', width: '100px', height: '65px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                      onClick={() => onPlayItem && onPlayItem(item)}
                      title="Kattints a megtekintéshez"
                    >
                      <img
                        src={item.screenshot_url || '/screenshots/placeholder.jpg'}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Play size={18} style={{ color: '#fff' }} />
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                          {item.game_title || item.video_title}
                        </h4>
                        {item.is_verified ? (
                          <span style={{
                            background: 'rgba(6, 214, 160, 0.15)',
                            color: 'var(--accent-green)',
                            border: '1px solid rgba(6, 214, 160, 0.35)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            ✓ Igazolt BudiCheck
                          </span>
                        ) : item.audit_status === 'rejected' ? (
                          <span style={{
                            background: 'rgba(255, 77, 109, 0.15)',
                            color: 'var(--accent-red)',
                            border: '1px solid rgba(255, 77, 109, 0.35)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            ❌ Fals találat
                          </span>
                        ) : item.audit_status === 'warning' ? (
                          <span style={{
                            background: 'rgba(255, 183, 3, 0.15)',
                            color: 'var(--accent-gold)',
                            border: '1px solid rgba(255, 183, 3, 0.35)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            ⚠️ Kérdéses
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            ⏳ Függőben
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Videó: {item.video_title} • <strong>{item.timestamp_formatted}</strong> ({item.matched_keyword})
                      </div>

                      <div style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-dim)',
                        fontStyle: 'italic',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '520px'
                      }}>
                        "{item.quote || 'Nem volt idézet rögzítve.'}"
                      </div>

                      {item.audit_notes && (
                        <div style={{
                          marginTop: '5px',
                          fontSize: '0.74rem',
                          color: item.audit_status === 'rejected'
                            ? '#ff758f'
                            : (item.is_verified ? '#06d6a0' : '#ffd166'),
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          maxWidth: '100%'
                        }}>
                          🤖 AI Audit: {item.audit_notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Scores */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 800, textTransform: 'uppercase' }}>
                        👑 Jani
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff' }}>
                        {Number(item.rating || 0).toFixed(1)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: '1.25rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 800, textTransform: 'uppercase' }}>
                        👥 Közösség
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#d8b4fe' }}>
                        {item.user_votes_count > 0 ? Number(item.user_votes_avg).toFixed(1) : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
                      onClick={() => handleResnapshotAdmin(item.id, 0)}
                      disabled={resnapshottingId === item.id}
                      title="Képkocka újravágása a videóból AI képválasztással"
                    >
                      <Camera size={13} className={resnapshottingId === item.id ? 'spin' : ''} />
                      <span>{resnapshottingId === item.id ? 'Vágás...' : '📸 Újravágás'}</span>
                    </button>

                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', borderColor: '#ffb703', color: '#ffb703' }}
                      onClick={() => handleSyncCheckTimestamp(item.id)}
                      disabled={syncingCheckId === item.id}
                      title="YouTube felirat alapján megkeresi az idézet pontos másodpercét és újravágja a képet"
                    >
                      <Target size={13} className={syncingCheckId === item.id ? 'spin' : ''} />
                      <span>{syncingCheckId === item.id ? 'Szinkron...' : '🎯 Idő Szinkron'}</span>
                    </button>

                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', borderColor: 'var(--accent-cyan)' }}
                      onClick={() => handleAuditSingleCheck(item.id)}
                      disabled={auditingCheckId === item.id}
                      title="AI Visszaellenőrzés futtatása erre az egyetlen kártyára"
                    >
                      <Sparkles size={13} className={auditingCheckId === item.id ? 'spin' : ''} style={{ color: 'var(--accent-cyan)' }} />
                      <span>{auditingCheckId === item.id ? 'Audit...' : 'AI Ellenőrzés'}</span>
                    </button>

                    <button
                      className={`btn ${item.is_verified ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                      onClick={() => handleVerifyCheck(item.id, !item.is_verified)}
                      title={item.is_verified ? 'Jóváhagyás visszavonása' : 'Kézi jóváhagyás'}
                    >
                      <CheckCircle size={13} />
                      <span>{item.is_verified ? 'Visszavonás' : 'Jóváhagyom'}</span>
                    </button>

                    <button
                      className="btn btn-secondary btn-icon"
                      onClick={() => onEditCheck && onEditCheck(item)}
                      title="Szerkesztés (játékcím, pontszám, idézet)"
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      className="btn btn-danger btn-icon"
                      onClick={() => handleDeleteCheck(item.id)}
                      title="Törlés (Nem valódi BudiCheck / fals találat)"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FELHASZNÁLÓI HIBABEJELENTÉSEK */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div>
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                  Látogatói Hibabejelentések
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  A nézők által bejelentett hibás vagy téves budi kártyák listája. Innen egy kattintással javíthatod vagy törölheted a fals találatokat!
                </p>
              </div>

              <button 
                className="btn btn-secondary" 
                onClick={() => fetchReports()}
                disabled={loadingReports}
                style={{ fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} className={loadingReports ? 'spin' : ''} />
                <span>Frissítés</span>
              </button>
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                className={`btn ${reportsFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                onClick={() => setReportsFilter('all')}
              >
                Összes ({reportsList.length})
              </button>
              <button
                className={`btn ${reportsFilter === 'open' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                onClick={() => setReportsFilter('open')}
              >
                🚨 Nyitott ({openReportsCount})
              </button>
              <button
                className={`btn ${reportsFilter === 'resolved' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                onClick={() => setReportsFilter('resolved')}
              >
                ✓ Megoldott ({reportsList.filter(r => r.status === 'resolved').length})
              </button>
            </div>
          </div>

          {loadingReports ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <RefreshCw className="spin" size={32} style={{ color: 'var(--accent-cyan)' }} />
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Bejelentések betöltése...</p>
            </div>
          ) : displayedReports.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(6, 214, 160, 0.15)',
                color: 'var(--accent-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <CheckCircle size={32} />
              </div>
              <h4 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.3rem', fontWeight: 800 }}>
                Nincs nyitott hibabejelentés!
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                A rangsorban szereplő összes budira vonatkozó bejelentést elintézted vagy még nem érkezett panasz.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {displayedReports.map((rep) => {
                const targetCheck = checksList.find(c => c.id === rep.check_id);
                return (
                  <div
                    key={rep.id}
                    className="glass-panel"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderLeft: rep.status === 'open' ? '4px solid var(--accent-red)' : '4px solid #64748b'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: rep.status === 'open' ? 'rgba(255, 77, 109, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                          color: rep.status === 'open' ? 'var(--accent-red)' : '#94a3b8',
                          border: `1px solid ${rep.status === 'open' ? 'rgba(255, 77, 109, 0.4)' : 'rgba(100, 116, 139, 0.4)'}`,
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}>
                          {rep.reason}
                        </span>

                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Bejelentve: {new Date(rep.created_at).toLocaleString('hu-HU')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {rep.status === 'open' ? (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                            onClick={() => handleUpdateReportStatus(rep.id, 'resolved')}
                          >
                            <Check size={14} />
                            <span>Megoldva</span>
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                            onClick={() => handleUpdateReportStatus(rep.id, 'open')}
                          >
                            <span>Újranyitás</span>
                          </button>
                        )}

                        <button
                          className="btn btn-danger btn-icon"
                          style={{ padding: '0.35rem' }}
                          onClick={() => handleDeleteReport(rep.id)}
                          title="Bejelentés törlése a listából"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Report description */}
                    {rep.details && (
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        fontSize: '0.88rem',
                        color: '#f1f5f9',
                        marginBottom: '1rem'
                      }}>
                        <strong>Felhasználó észrevétele:</strong> "{rep.details}"
                      </div>
                    )}

                    {/* Associated Budi Card preview & Direct actions */}
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.35)',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.8rem',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {rep.screenshot_url && (
                          <img
                            src={rep.screenshot_url}
                            alt=""
                            style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '5px' }}
                          />
                        )}
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>
                            {rep.game_title} ({rep.timestamp_formatted})
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {rep.video_title}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {targetCheck && onEditCheck && (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}
                            onClick={() => onEditCheck(targetCheck)}
                          >
                            <Edit3 size={14} />
                            <span>Kártya Szerkesztése</span>
                          </button>
                        )}

                        <button
                          className="btn btn-danger"
                          style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}
                          onClick={() => handleDeleteFromReport(rep.check_id, rep.id)}
                          title="Budi kártya azonnali törlése és a bejelentés lezárása"
                        >
                          <Trash2 size={14} />
                          <span>Kártya Törlése & Lezárás</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: KERESŐ & RENDSZER BEÁLLÍTÁSOK (ORIGINAL WORKFLOWS) */}
      {/* ========================================================================= */}
      {activeTab === 'system' && (
        <div>
          {/* STATS OVERVIEW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Kereső Állapota
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isRunning ? 'var(--accent-cyan)' : isPaused ? 'var(--accent-gold)' : '#fff', marginTop: '4px' }}>
                {isRunning ? '⚡ Fut folyamatban...' : isPaused ? '⏸ Szüneteltetve' : '💤 Várakozik (Idle)'}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Feldolgozott Videók
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>
                {status.processed_count || 0} / {status.total_channel_videos || 0}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Talált Budi Checkek
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '4px' }}>
                {status.matches_found || 0} db
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Gemini AI Kapcsolat
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: config.has_gemini_api_key ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '6px' }}>
                {config.has_gemini_api_key ? '✓ Csatlakoztatva' : '✗ Nincs API kulcs'}
              </div>
            </div>
          </div>

          {/* SECTION 1: SCANNER CONTROLS */}
          <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem' }}>
              Budi Kereső Vezérlése (YouTube Scanner)
            </h3>

            {isRunning && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--accent-cyan)' }}>
                    Jelenleg vizsgált videó: <strong>{status.current_video_title || 'Betöltés...'}</strong>
                  </span>
                  <span style={{ fontWeight: 700 }}>{progressPct}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {!isRunning ? (
                <>
                  <button className="btn btn-primary" onClick={() => handleStart(false)}>
                    <Play size={16} />
                    <span>Keresés Indítása ({maxVideos} videó)</span>
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleStart(true)} title="Csak a legújabb videókat ellenőrzi">
                    <Zap size={16} />
                    <span>Inkrementális Frissítés</span>
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={handlePause}>
                    <Pause size={16} />
                    <span>Szüneteltetés</span>
                  </button>
                  <button className="btn btn-danger" onClick={handleStop}>
                    <Square size={16} />
                    <span>Leállítás</span>
                  </button>
                </>
              )}
            </div>

            {/* SINGLE VIDEO SCAN */}
            <form onSubmit={handleSingleScan} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
              <input
                type="text"
                className="form-input"
                style={{ flex: '1 1 300px' }}
                placeholder="Egyedi videó vizsgálata (pl. https://www.youtube.com/watch?v=...)"
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary">
                <Search size={16} />
                <span>Egyedi Videó Ellenőrzése</span>
              </button>
            </form>
          </div>

          {/* SECTION 2: NULLÁZÁSI ÉS KARBANTARTÁSI KÖZPONT */}
          <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <Database size={20} style={{ color: 'var(--accent-gold)' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Adatbázis Karbantartás & Nullázás</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Itt külön-külön vagy teljesen egyben is alaphelyzetbe állíthatod a rendszer adatait, a látogatók szavazatait vagy a feldolgozási előzményeket.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--accent-purple)' }}>
                    <UserCheck size={18} />
                    <span>Közösségi Szavazatok Nullázása</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Törli az összes látogatói szavazatot a kvízből. A mentett budi rekordok és Janival kapcsolatos értékelések megmaradnak.
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={handleResetVotes} style={{ width: '100%', justifyContent: 'center' }}>
                  <RotateCcw size={15} />
                  <span>Szavazatok Nullázása</span>
                </button>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--accent-cyan)' }}>
                    <Activity size={18} />
                    <span>Szkennelt Videó Előzmények Törlése</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Törli a "már ellenőrzött videók" listáját. Így az összes videót újra át tudja nézni a kereső, de a már talált budikat NEM törli ki.
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={handleResetHistory} style={{ width: '100%', justifyContent: 'center' }}>
                  <RotateCcw size={15} />
                  <span>Videó Előzmények Nullázása</span>
                </button>
              </div>

              <div style={{ background: 'rgba(255, 77, 109, 0.05)', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(255, 77, 109, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--accent-red)' }}>
                    <AlertTriangle size={18} />
                    <span>TELJES Rendszer Reset (Minden törlése)</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Mindent töröl: az összes mentett budi értékelést, képernyőképet, videó listát és naplót. A rendszer tiszta lapot kap.
                  </p>
                </div>
                <button className="btn btn-danger" onClick={handleFullReset} style={{ width: '100%', justifyContent: 'center' }}>
                  <Trash2 size={15} />
                  <span>Minden Adat Végleges Törlése</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: GEMINI AI KONFIGURÁCIÓ & KVÓTÁK */}
          <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Gemini AI Konfiguráció & Kvóták</h3>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => fetchModels(true)}
                disabled={loadingModels}
                style={{ fontSize: '0.82rem' }}
              >
                <RefreshCw size={14} className={loadingModels ? 'spin' : ''} />
                <span>Kvóták Frissítése</span>
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveConfig(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Google Gemini API Kulcs</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={config.masked_api_key ? `Jelenlegi kulcs: ${config.masked_api_key}` : "AIzaSy..."}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
              </div>

              {configFeedback && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  background: configFeedback.type === 'success' ? 'rgba(6, 214, 160, 0.15)' : 'rgba(255, 77, 109, 0.15)',
                  color: configFeedback.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
                  border: `1px solid ${configFeedback.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`
                }}>
                  {configFeedback.text}
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={savingConfig} style={{ alignSelf: 'flex-start' }}>
                <span>{savingConfig ? 'Mentés...' : 'AI Beállítások Mentése'}</span>
              </button>
            </form>
          </div>

          {/* SECTION 4: LIVE SCANNER CONSOLE */}
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Élő Folyamatnapló (Console)</h3>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-icon" onClick={copyLogs} title="Napló másolása">
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button className="btn btn-secondary btn-icon" onClick={handleClearLogs} title="Napló törlése">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div 
              ref={consoleEndRef}
              style={{
                background: '#07090e',
                border: '1px solid #1a2234',
                borderRadius: '8px',
                padding: '1rem',
                fontFamily: 'Consolas, monospace',
                fontSize: '0.82rem',
                height: '350px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              {filteredLogs.length === 0 ? (
                <div style={{ color: '#64748b', fontStyle: 'italic' }}>Nincsenek még naplóbejegyzések.</div>
              ) : (
                filteredLogs.map((l, i) => (
                  <div key={i} style={{
                    color: l.level === 'match' || l.level === 'success' ? '#06d6a0' : l.level === 'warning' ? '#ffb703' : l.level === 'snapshot' ? '#00f2fe' : '#94a3b8'
                  }}>
                    <span style={{ color: '#475569', marginRight: '8px' }}>[{l.time}]</span>
                    <span>{l.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD CHANGE MODAL */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Admin Jelszó Módosítása</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowPasswordModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="modal-body">
              <div className="form-group">
                <label className="form-label">Jelenlegi Jelszó</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Új Jelszó (min. 4 karakter)</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Új Jelszó Megerősítése</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {passwordChangeMsg && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                  background: passwordChangeMsg.type === 'success' ? 'rgba(6, 214, 160, 0.15)' : 'rgba(255, 77, 109, 0.15)',
                  color: passwordChangeMsg.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'
                }}>
                  {passwordChangeMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  Mégse
                </button>
                <button type="submit" className="btn btn-primary" disabled={changingPassword}>
                  <span>{changingPassword ? 'Mentés...' : 'Jelszó Frissítése'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
