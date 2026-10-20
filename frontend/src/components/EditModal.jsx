import React, { useState } from 'react';
import { X, Save, Clock, Target, Loader2 } from 'lucide-react';

export default function EditModal({ item, onSave, onClose }) {
  if (!item) return null;

  const [gameTitle, setGameTitle] = useState(item.game_title || item.video_title || '');
  const [rating, setRating] = useState(item.rating || 7.0);
  const [quote, setQuote] = useState(item.quote || '');
  const [timestamp, setTimestamp] = useState(item.timestamp_formatted || '');
  const [syncingTime, setSyncingTime] = useState(false);
  const [syncingGame, setSyncingGame] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const handleSyncGameTitle = async () => {
    setSyncingGame(true);
    setSyncMsg(null);
    try {
      const token = localStorage.getItem('budicheck_admin_token') || '';
      const res = await fetch(`/api/checks/${item.id}/sync-game-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGameTitle(data.game_title);
        setSyncMsg({
          type: 'success',
          text: `🎮 Siker! Játéknév beállítva a YouTube fejezet alapján: "${data.game_title}"`
        });
      } else {
        setSyncMsg({
          type: 'error',
          text: data.detail || 'Nem található specifikus YouTube fejezet ehhez az időponthoz.'
        });
      }
    } catch (e) {
      setSyncMsg({ type: 'error', text: 'Hálózati hiba a játékcím szinkronizálásakor.' });
    } finally {
      setSyncingGame(false);
    }
  };

  const handleSyncTimestamp = async () => {
    setSyncingTime(true);
    setSyncMsg(null);
    try {
      const token = localStorage.getItem('budicheck_admin_token') || '';
      const res = await fetch(`/api/checks/${item.id}/sync-timestamp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTimestamp(data.item.timestamp_formatted);
        setSyncMsg({
          type: 'success',
          text: `🎯 Siker! Megtalálva: ${data.item.timestamp_formatted} (${data.item.timestamp_sec}s)! A kép és videó automatikusan szinkronizálva.`
        });
        if (data.item.game_title) setGameTitle(data.item.game_title);
        if (data.item.rating !== undefined) setRating(data.item.rating);
      } else {
        setSyncMsg({
          type: 'error',
          text: data.detail || 'Nem sikerült az idézetet a feliratban megtalálni. Add meg manuálisan az időpontot!'
        });
      }
    } catch (e) {
      setSyncMsg({ type: 'error', text: 'Hálózati hiba a szinkronizálás közben.' });
    } finally {
      setSyncingTime(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(item.id, parseFloat(rating), quote, gameTitle, timestamp);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Bejegyzés Szerkesztése</h3>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>🎮 Játék Neve</label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSyncGameTitle}
                disabled={syncingGame}
                style={{
                  fontSize: '0.78rem',
                  padding: '3px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: 'var(--accent-cyan)',
                  borderColor: 'rgba(0, 242, 254, 0.4)'
                }}
                title="A videó YouTube fejezetei/timestamps alapján automatikusan megállapítja az adott pillanatban játszott játékot"
              >
                {syncingGame ? <Loader2 size={13} className="spin" /> : <Target size={13} />}
                <span>{syncingGame ? 'Keresés...' : '🎯 Játék lekérése fejezetből'}</span>
              </button>
            </div>
            <input
              className="form-input"
              value={gameTitle}
              onChange={(e) => setGameTitle(e.target.value)}
              placeholder="pl. Silent Hill 2, Lobotomy, Black Pines..."
              style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Eredeti YouTube Videó Cím</label>
            <input className="form-input" value={item.video_title} disabled style={{ opacity: 0.6, fontSize: '0.85rem' }} />
          </div>

          {/* Timestamp editing & Auto-detection */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '6px' }}>
              <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={15} style={{ color: 'var(--accent-cyan)' }} />
                <span>Időbélyeg (óó:pp:mp vagy mp)</span>
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSyncTimestamp}
                disabled={syncingTime}
                style={{
                  fontSize: '0.78rem',
                  padding: '3px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: 'var(--accent-cyan)',
                  borderColor: 'rgba(0, 242, 254, 0.4)'
                }}
                title="A YouTube felirat alapján automatikusan megkeresi azt a másodpercet, ahol Jani kimondja az idézetet"
              >
                {syncingTime ? <Loader2 size={13} className="spin" /> : <Target size={13} />}
                <span>{syncingTime ? 'Felirat keresése...' : '🎯 Idézet pontos idejének felderítése'}</span>
              </button>
            </div>
            <input
              className="form-input"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              placeholder="pl. 01:08:50 vagy 4130"
              style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}
            />
            {syncMsg && (
              <div style={{
                marginTop: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                background: syncMsg.type === 'success' ? 'rgba(6, 214, 160, 0.12)' : 'rgba(255, 77, 109, 0.12)',
                color: syncMsg.type === 'success' ? '#06d6a0' : '#ff758f',
                border: `1px solid ${syncMsg.type === 'success' ? 'rgba(6, 214, 160, 0.3)' : 'rgba(255, 77, 109, 0.3)'}`
              }}>
                {syncMsg.text}
              </div>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Ha megváltoztatod az időt, a rendszer automatikusan új képkockát vág ki a videóból és a beágyazott lejátszót is átállítja!
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              Pontszám (0.0 - 10.0 Skálán): <strong style={{ color: 'var(--accent-cyan)', fontSize: '1.1rem' }}>{parseFloat(rating).toFixed(1)}</strong>
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              style={{ width: '100%', margin: '0.5rem 0' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              <span>0 (Katasztrófa)</span>
              <span>5 (Átlagos)</span>
              <span>10 (Mestermű)</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Idézet / Mit mondott róla</label>
            <textarea
              className="form-textarea"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Írd be vagy szerkeszd a videóban elhangzott véleményt..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Mégse
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} />
              <span>Mentés</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
