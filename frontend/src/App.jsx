import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import TierListView from './components/TierListView';
import BudiCard from './components/BudiCard';
import BudiTable from './components/BudiTable';
import VideoModal from './components/VideoModal';
import EditModal from './components/EditModal';
import ReportModal from './components/ReportModal';
import AdminPanel from './components/AdminPanel';
import BudiGame from './components/BudiGame';
import TopographicBackground from './components/TopographicBackground';
import Footer from './components/Footer';
import { Sparkles, RefreshCw, Trophy, Shield } from 'lucide-react';

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    return window.location.pathname.startsWith('/config/admin');
  });

  const [status, setStatus] = useState({
    status: 'idle',
    total_channel_videos: 0,
    processed_count: 0,
    matches_found: 0,
    current_video_title: '',
    scanned_videos_count: 0,
    logs: []
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState('all');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('rating_desc');
  const [viewMode, setViewMode] = useState('tierlist');

  // Modals
  const [playingItem, setPlayingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [reportingItem, setReportingItem] = useState(null);
  const [reportingGeneral, setReportingGeneral] = useState(false);

  // Admin session reactive state
  const [hasAdminSession, setHasAdminSession] = useState(() => {
    return Boolean(localStorage.getItem('budicheck_admin_token'));
  });

  const checkAdminSession = async () => {
    const token = localStorage.getItem('budicheck_admin_token');
    if (!token) {
      setHasAdminSession(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/check', {
        headers: { 'x-admin-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        const valid = Boolean(data.authenticated);
        setHasAdminSession(valid);
        if (!valid) {
          localStorage.removeItem('budicheck_admin_token');
        }
      } else {
        setHasAdminSession(false);
      }
    } catch {
      setHasAdminSession(Boolean(token));
    }
  };

  // Sync route with browser history and listen for auth changes
  useEffect(() => {
    const handlePopState = () => {
      setIsAdminRoute(window.location.pathname.startsWith('/config/admin'));
    };
    const handleAuthChange = () => {
      checkAdminSession();
    };

    const handleItemUpdated = () => {
      fetchChecks();
    };

    checkAdminSession();
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('budicheck_auth_changed', handleAuthChange);
    window.addEventListener('budicheck_item_updated', handleItemUpdated);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('budicheck_auth_changed', handleAuthChange);
      window.removeEventListener('budicheck_item_updated', handleItemUpdated);
    };
  }, [isAdminRoute]);

  const navigateToAdmin = (showAdmin) => {
    if (showAdmin) {
      window.history.pushState({}, '', '/config/admin');
      setIsAdminRoute(true);
    } else {
      window.history.pushState({}, '', '/');
      setIsAdminRoute(false);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('budicheck_admin_token') || '';
      const headers = token ? { 'x-admin-token': token } : {};
      const res = await fetch('/api/status', { headers });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch status:', e);
    }
  };

  const fetchChecks = async () => {
    try {
      const isTierList = viewMode === 'tierlist' || viewMode === 'community_tierlist';
      let url = `/api/checks?sort_by=${sortBy}`;
      if (!isTierList) {
        if (minRating > 0) {
          url += `&min_rating=${minRating}`;
          if (preset === 'masterpiece') url += `&max_rating=10.0`;
          else if (preset === 'good') url += `&max_rating=8.9`;
          else if (preset === 'average') url += `&max_rating=6.9`;
          else if (preset === 'bad') url += `&max_rating=3.9`;
        }
        if (search) {
          url += `&search=${encodeURIComponent(search)}`;
        }
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (e) {
      console.error('Failed to fetch checks:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchChecks();
    const interval = setInterval(() => {
      fetchStatus();
      if (status.status === 'running') {
        fetchChecks();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [status.status, minRating, preset, search, sortBy]);

  const handleDelete = async (checkId) => {
    let token = localStorage.getItem('budicheck_admin_token') || '';
    if (!token) {
      const pass = window.prompt('Adminisztrátori jelszó szükséges a törléshez:');
      if (!pass) return;
      try {
        const loginRes = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass })
        });
        if (!loginRes.ok) {
          alert('Helytelen admin jelszó!');
          return;
        }
        const d = await loginRes.json();
        token = d.token;
        localStorage.setItem('budicheck_admin_token', token);
        setHasAdminSession(true);
      } catch {
        alert('Hálózati hiba a bejelentkezéskor.');
        return;
      }
    }
    if (window.confirm('Biztosan törölni szeretnéd ezt a WC értékelést?')) {
      const res = await fetch(`/api/checks/${checkId}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token }
      });
      if (res.ok) {
        fetchChecks();
        fetchStatus();
      } else {
        alert('Nem sikerült törölni a bejegyzést (érvénytelen admin munkamenet).');
      }
    }
  };

  const handleSaveEdit = async (checkId, rating, quote, gameTitle, timestamp) => {
    let token = localStorage.getItem('budicheck_admin_token') || '';
    if (!token) {
      const pass = window.prompt('Adminisztrátori jelszó szükséges a módosítás mentéséhez:');
      if (!pass) {
        throw new Error('Admin hitelesítés nélkül a módosítás nem menthető!');
      }
      const loginRes = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });
      if (!loginRes.ok) {
        const d = await loginRes.json().catch(() => ({}));
        throw new Error(d.detail || 'Helytelen admin jelszó!');
      }
      const d = await loginRes.json();
      token = d.token;
      localStorage.setItem('budicheck_admin_token', token);
      setHasAdminSession(true);
    }

    const res = await fetch(`/api/checks/${checkId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify({ rating, quote, game_title: gameTitle, timestamp })
    });

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('budicheck_admin_token');
        setHasAdminSession(false);
        const pass = window.prompt('Az admin munkamenet lejárt! Kérlek add meg a jelszót újra:');
        if (pass) {
          const loginRes = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
          });
          if (loginRes.ok) {
            const d = await loginRes.json();
            localStorage.setItem('budicheck_admin_token', d.token);
            setHasAdminSession(true);
            return handleSaveEdit(checkId, rating, quote, gameTitle, timestamp);
          }
        }
        throw new Error('Lejárt vagy érvénytelen admin munkamenet.');
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Hiba történt a mentés során a szerveren.');
    }

    const resData = await res.json().catch(() => ({}));
    if (resData.item) {
      setItems(prev => prev.map(c => c.id === checkId ? { ...c, ...resData.item } : c));
      window.dispatchEvent(new CustomEvent('budicheck_item_updated', { detail: resData.item }));
    }

    setEditingItem(null);
    fetchChecks();
    fetchStatus();
    return resData;
  };

  return (
    <div className="app" style={{ position: 'relative', minHeight: '100vh' }}>
      <TopographicBackground />
      <Header 
        status={status} 
        onRefresh={() => { fetchStatus(); fetchChecks(); }}
        onGoToAdmin={navigateToAdmin}
        isAdminView={isAdminRoute}
        hasAdminSession={hasAdminSession}
        onOpenGeneralReport={() => setReportingGeneral(true)}
      />

      {isAdminRoute ? (
        <AdminPanel 
          status={status}
          onRefreshStatus={fetchStatus}
          onRefreshChecks={fetchChecks}
          onBackToPublic={() => navigateToAdmin(false)}
          onEditCheck={setEditingItem}
          onPlayItem={setPlayingItem}
        />
      ) : (
        <main className="container" style={{ marginTop: '1.5rem', marginBottom: '4rem' }}>
          {/* COMMUNITY QUIZ & MINIGAME BANNER */}
          <BudiGame onPlayItem={setPlayingItem} />

          {/* FILTER AND CONTROLS BAR */}
          <FilterBar
            search={search}
            setSearch={setSearch}
            preset={preset}
            setPreset={setPreset}
            minRating={minRating}
            setMinRating={setMinRating}
            sortBy={sortBy}
            setSortBy={setSortBy}
            viewMode={viewMode}
            setViewMode={setViewMode}
            totalItems={items.length}
          />

          {/* LISTINGS / TIER LIST / GRID / TABLE */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <RefreshCw className="spin" size={32} style={{ color: 'var(--accent-cyan)' }} />
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>BudiCheck adatok betöltése...</p>
            </div>
          ) : items.length > 0 ? (
            (viewMode === 'tierlist' || viewMode === 'community_tierlist') ? (
              <TierListView
                checks={items}
                onSelectCheck={setPlayingItem}
                isCommunityMode={viewMode === 'community_tierlist'}
                onReport={setReportingItem}
              />
            ) : viewMode === 'grid' ? (
              <div className="budi-grid">
                {items.map((item) => (
                  <BudiCard
                    key={item.id}
                    item={item}
                    onPlay={setPlayingItem}
                    onEdit={hasAdminSession ? setEditingItem : null}
                    onDelete={hasAdminSession ? handleDelete : null}
                    onReport={setReportingItem}
                  />
                ))}
              </div>
            ) : (
              <BudiTable
                items={items}
                onPlay={setPlayingItem}
                onEdit={hasAdminSession ? setEditingItem : null}
                onDelete={hasAdminSession ? handleDelete : null}
                onReport={setReportingItem}
              />
            )
          ) : viewMode === 'table' ? (
            <BudiTable
              items={[]}
              onPlay={setPlayingItem}
              onEdit={hasAdminSession ? setEditingItem : null}
              onDelete={hasAdminSession ? handleDelete : null}
              onReport={setReportingItem}
            />
          ) : (
            <div className="glass-panel empty-state">
              <div className="empty-icon">🚽</div>
              <h3 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '0.5rem' }}>
                Még nem található a szűrőnek megfelelő "Budi Check"
              </h3>
              <p style={{ maxWidth: '500px', margin: '0 auto 1.5rem', fontSize: '0.95rem' }}>
                Az adatbázis jelenleg üres vagy a beállított szűrők nem adnak találatot.
              </p>
              {hasAdminSession && (
                <button className="btn btn-primary" onClick={() => navigateToAdmin(true)}>
                  <Shield size={18} />
                  <span>Irány az Adminisztrációs Felület</span>
                </button>
              )}
            </div>
          )}
        </main>
      )}

      {/* FOOTER (PUBLIC VIEW) */}
      {!isAdminRoute && (
        <Footer
          status={status}
          checksCount={items.length}
          onOpenGeneralReport={() => setReportingGeneral(true)}
        />
      )}

      {/* VIDEO MODAL */}
      {playingItem && (
        <VideoModal
          item={playingItem}
          onClose={() => setPlayingItem(null)}
          onEdit={hasAdminSession ? (item) => {
            setPlayingItem(null);
            setEditingItem(item);
          } : null}
          onDelete={hasAdminSession ? handleDelete : null}
          onReport={setReportingItem}
        />
      )}

      {/* EDIT MODAL (ADMIN ONLY) */}
      {editingItem && (
        <EditModal
          item={editingItem}
          onSave={handleSaveEdit}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* REPORT MODAL (ANY VISITOR) */}
      {reportingItem && (
        <ReportModal
          item={reportingItem}
          onClose={() => setReportingItem(null)}
          onSuccess={() => {
            fetchStatus();
          }}
        />
      )}

      {/* GENERAL FEEDBACK / BUG REPORT MODAL */}
      {reportingGeneral && (
        <ReportModal
          isGeneral={true}
          onClose={() => setReportingGeneral(false)}
          onSuccess={() => {
            fetchStatus();
          }}
        />
      )}
    </div>
  );
}
