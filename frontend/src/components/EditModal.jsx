import React, { useState } from 'react';
import { X, Save, Clock, Target, Loader2, Camera, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

export default function EditModal({ item, onSave, onClose }) {
  if (!item) return null;

  const [gameTitle, setGameTitle] = useState(item.game_title || item.video_title || '');
  const [rating, setRating] = useState(item.rating || 7.0);
  const [quote, setQuote] = useState(item.quote || '');
  const [timestamp, setTimestamp] = useState(item.timestamp_formatted || '');
  const [screenshotUrl, setScreenshotUrl] = useState(item.screenshot_url || '');
  const [syncingTime, setSyncingTime] = useState(false);
  const [syncingGame, setSyncingGame] = useState(false);
  const [resnapshotting, setResnapshotting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);

  const handleResnapshot = async (offsetSec = 0) => {
    setResnapshotting(true);
    setSyncMsg(null);
    try {
      const token = localStorage.getItem('budicheck_admin_token') || '';
      const res = await fetch(`/api/checks/${item.id}/resnapshot`, {
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
        const freshUrl = `${data.screenshot_url}?t=${Date.now()}`;
        setScreenshotUrl(freshUrl);
        setTimestamp(data.timestamp_formatted);
        setSyncMsg({
          type: 'success',
          text: `📸 Siker! Új képkocka kivágva (${data.timestamp_formatted}).`
        });
        item.screenshot_url = data.screenshot_url;
        item.timestamp_sec = data.timestamp_sec;
        item.timestamp_formatted = data.timestamp_formatted;
        window.dispatchEvent(new CustomEvent('budicheck_item_updated', { detail: data.item }));
      } else {
        setSyncMsg({
          type: 'error',
          text: data.detail || 'Nem sikerült újraképkockázni a videót.'
        });
      }
    } catch (e) {
      setSyncMsg({ type: 'error', text: 'Hálózati hiba az újraképkockázás közben.' });
    } finally {
      setResnapshotting(false);
    }
  };

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
        if (data.item.screenshot_url) {
          setScreenshotUrl(`${data.item.screenshot_url}?t=${Date.now()}`);
        }
        setSyncMsg({
          type: 'success',
          text: `🎯 Siker! Megtalálva: ${data.item.timestamp_formatted} (${data.item.timestamp_sec}s)! A kép és videó automatikusan szinkronizálva.`
        });
        if (data.item.game_title) setGameTitle(data.item.game_title);
        if (data.item.rating !== undefined) setRating(data.item.rating);
        window.dispatchEvent(new CustomEvent('budicheck_item_updated', { detail: data.item }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(item.id, parseFloat(rating), quote, gameTitle, timestamp);
    } catch (err) {
      setSaveError(err.message || 'Nem sikerült elmenteni a módosításokat.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Bejegyzés Szerkesztése</h3>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Screenshot Preview & Recut Control Bar */}
          <div className="form-group" style={{
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '10px',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Camera size={15} style={{ color: 'var(--accent-cyan)' }} />
                <span>Képernyőkép & Újravágás</span>
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                {timestamp}
              </span>
            </div>

            <div style={{
              position: 'relative',
              width: '100%',
              height: '185px',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#090b10',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '10px'
            }}>
              <img
                src={screenshotUrl || '/screenshots/placeholder.jpg'}
                alt="Budi preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80'; }}
              />
              {resnapshotting && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: 'var(--accent-cyan)',
                  zIndex: 5
                }}>
                  <Loader2 size={28} className="spin" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    📸 Új képkocka kivágása a YouTube videóból...
                  </span>
                </div>
              )}
            </div>

            {/* Recut buttons: -3s, AI Vision resnapshot, +3s */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleResnapshot(-3)}
                disabled={resnapshotting}
                style={{ fontSize: '0.8rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="3 másodperccel korábbi pillanat kivágása"
              >
                <ChevronLeft size={14} />
                <span>-3 mp</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleResnapshot(0)}
                disabled={resnapshotting}
                style={{
                  fontSize: '0.82rem',
                  padding: '6px 12px',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, var(--accent-cyan) 0%, #0099ff 100%)',
                  fontWeight: 700,
                  color: '#000'
                }}
                title="A jelenlegi időpont körül új képkockákat vizsgál meg, és AI segítségével a legtisztább budi képet választja ki"
              >
                {resnapshotting ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}
                <span>📸 Kép Újravágása (AI Vision)</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleResnapshot(3)}
                disabled={resnapshotting}
                style={{ fontSize: '0.8rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="3 másodperccel későbbi pillanat kivágása"
              >
                <span>+3 mp</span>
                <ChevronRight size={14} />
              </button>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '6px', textAlign: 'center' }}>
              Tipp: Ha Jani később ért be a mosdóba, kattints a <strong>+3 mp</strong>-re, vagy az <strong>Újravágás</strong>ra!
            </div>
          </div>

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

          {saveError && (
            <div style={{
              marginTop: '1rem',
              marginBottom: '0.5rem',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 77, 109, 0.15)',
              border: '1px solid rgba(255, 77, 109, 0.4)',
              color: '#ff758f',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{saveError}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Mégse
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSaving || resnapshotting || syncingTime || syncingGame}
              style={{ minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              <span>{isSaving ? 'Mentés...' : 'Mentés'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
