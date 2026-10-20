import React, { useState } from 'react';
import { AlertTriangle, Send, X, CheckCircle, Bug, Trash2 } from 'lucide-react';

const PRESET_REASONS = [
  'Nem valódi BudiCheck (csak szóba került a budi, de nincs értékelés)',
  'Hibás játékcím vagy videócím',
  'Rossz vagy pontatlan pontszám',
  'Hibás / elcsúszott képernyőkép',
  'Egyéb hiba / észrevétel'
];

export default function ReportModal({ item, onClose, onSuccess }) {
  if (!item) return null;

  const [reason, setReason] = useState(PRESET_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_id: item.id,
          reason,
          details
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
              <Bug size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                Hibás Budi Kártya Bejelentése
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Segíts tisztán tartani a rangsort a fals találatoktól!
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
              Köszönjük a bejelentést!
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto' }}>
              Az adminisztrátor megkapta a jelzésedet, és ellenőrizni fogja a kártyát az admin felületen.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '1.5rem' }}>
            {/* ITEM SUMMARY CARD */}
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
                Mi a probléma a kártyával?
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {PRESET_REASONS.map((r) => (
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
                Részletesebb leírás az adminnak (opcionális):
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Pl. Jani ebben a videóban nem értékelt budit, csak épp elment mellette, vagy más pontot adott rá..."
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
