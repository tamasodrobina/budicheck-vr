import React, { useState, useRef } from 'react';
import { AlertTriangle, Send, X, CheckCircle, Bug, Smartphone, Lightbulb } from 'lucide-react';

const ITEM_REASONS = [
  'Nem valódi BudiCheck (csak szóba került a budi, de nincs értékelés)',
  'Hibás játékcím vagy videócím',
  'Rossz vagy pontatlan pontszám',
  'Hibás / elcsúszott képernyőkép',
  'Egyéb hiba / észrevétel'
];

const GENERAL_REASONS = [
  '📱 Rossz mobilos nézet / elcsúszott elrendezés',
  '⚡ Videó vagy képernyőkép betöltési hiba',
  '💡 Ötlet / Funkció javaslat az oldalhoz',
  '🐛 Működési hiba / Bug az oldalon',
  '❓ Egyéb általános észrevétel'
];

export default function ReportModal({ item, isGeneral = false, onClose, onSuccess }) {
  const isGeneralMode = isGeneral || !item;
  const reasonsList = isGeneralMode ? GENERAL_REASONS : ITEM_REASONS;

  const [reason, setReason] = useState(reasonsList[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [hpToken, setHpToken] = useState('');
  const loadTimeRef = useRef(Date.now());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_id: item?.id || 'general',
          reason,
          details,
          hp_token: hpToken,
          client_ts: loadTimeRef.current
        })
      });

      if (res.ok) {
        setSubmitted(true);
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        const data = await res.json();
        setError(data.detail || 'Nem sikerült elküldeni a bejelentést.');
      }
    } catch (err) {
      setError('Hálózati hiba történt a bejelentés küldése közben.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '520px', border: '1px solid rgba(255, 77, 109, 0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 77, 109, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 77, 109, 0.15)',
              border: '1px solid rgba(255, 77, 109, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-red)'
            }}>
              {isGeneralMode ? <Smartphone size={18} /> : <Bug size={18} />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                {isGeneralMode ? 'Weboldal Hiba & Visszajelzés' : 'Hibás Budi Kártya Bejelentése'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isGeneralMode 
                  ? 'Mobilos nézet, lejátszó hiba vagy javaslat az oldalhoz' 
                  : 'Segíts tisztán tartani a rangsort a fals találatoktól!'}
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose} title="Bezárás">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(6, 214, 160, 0.15)',
              border: '2px solid var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-green)',
              margin: '0 auto 1rem'
            }}>
              <CheckCircle size={32} />
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
              Köszönjük a visszajelzést!
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto' }}>
              {isGeneralMode
                ? 'Az észrevételedet megkaptuk, hamarosan javítjuk vagy átnézzük a mobilos nézetet/funkciót.'
                : 'Az adminisztrátor megkapta a jelzésedet, és ellenőrizni fogja a kártyát az admin felületen.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '1.5rem' }}>
            {/* Honeypot field for bot detection */}
            <input
              type="text"
              name="hp_field"
              value={hpToken}
              onChange={(e) => setHpToken(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}
            />

            {/* CONTEXT BANNER */}
            {isGeneralMode ? (
              <div style={{
                background: 'rgba(255, 117, 143, 0.08)',
                border: '1px solid rgba(255, 117, 143, 0.25)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ fontSize: '1.8rem' }}>📱</div>
                <div style={{ fontSize: '0.84rem', color: '#f1f5f9', lineHeight: 1.45 }}>
                  Bármilyen hibát találtál (pl. kilógó gomb mobilon, nem induló videó, vagy új ötleted van), írd meg bátran!
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <img
                  src={item.screenshot_url || '/screenshots/placeholder.jpg'}
                  alt=""
                  style={{ width: '60px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.game_title || item.video_title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
                    Időbélyeg: {item.timestamp_formatted} • Pontszám: 👑 {item.rating}/10
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(255, 77, 109, 0.15)',
                border: '1px solid rgba(255, 77, 109, 0.4)',
                color: '#ff4d6d',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                {error}
              </div>
            )}

            {/* REASON PRESETS */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700, color: '#fff' }}>
                {isGeneralMode ? 'Milyen jellegű a visszajelzésed?' : 'Mi a probléma a kártyával?'}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {reasonsList.map((r) => (
                  <label
                    key={r}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0.55rem 0.8rem',
                      background: reason === r ? 'rgba(255, 77, 109, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${reason === r ? 'rgba(255, 77, 109, 0.4)' : 'rgba(255, 255, 255, 0.07)'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: reason === r ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="radio"
                      name="report_reason"
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      style={{ accentColor: 'var(--accent-red)' }}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* DETAILS TEXTAREA */}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 700, color: '#fff' }}>
                {isGeneralMode ? 'Részletes leírás (készülék, hiba leírása vagy javaslat):' : 'Részletesebb leírás az adminnak (opcionális):'}
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={isGeneralMode 
                  ? "Pl. iPhone 13-on Safari alatt a kártyák jobb oldala kilóg, vagy jó lenne egy olyan gomb, hogy..." 
                  : "Pl. Jani ebben a videóban nem értékelt budit, csak épp elment mellette, vagy más pontot adott rá..."}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            {/* BUTTONS */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Mégse
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={submitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700
                }}
              >
                <Send size={15} />
                <span>{submitting ? 'Küldés...' : 'Bejelentés Küldése'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
