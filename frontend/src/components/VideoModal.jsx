import React, { useState } from 'react';
import { X, ExternalLink, Image as ImageIcon, Video as VideoIcon, Edit3, Sparkles, Gamepad2, Users, Bug, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { getScoreBadgeClass } from './BudiCard';

export default function VideoModal({ item, onClose, onEdit, onDelete, onReport }) {
  if (!item) return null;

  // If the screenshot has a warning or is flagged, default directly to video so the user hears/sees Jani right away!
  const [viewMode, setViewMode] = useState(item.audit_status === 'warning' ? 'video' : 'image');
  const rating = item.rating || 0;
  const badgeClass = getScoreBadgeClass(rating);

  const embedUrl = `https://www.youtube.com/embed/${item.video_id}?start=${Math.floor(item.timestamp_sec || 0)}&autoplay=1`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Gamepad2 size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0, wordBreak: 'break-word', lineHeight: 1.25 }}>
                  {item.game_title || item.video_title}
                </h3>
                {item.is_verified ? (
                  <span style={{
                    background: 'rgba(6, 214, 160, 0.95)',
                    color: '#021811',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    padding: '2px 7px',
                    borderRadius: '5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }} title="Admin és AI által igazolt valódi BudiCheck">
                    <CheckCircle size={10} />
                    <span>Igazolt</span>
                  </span>
                ) : item.audit_status === 'warning' ? (
                  <span style={{
                    background: 'rgba(255, 183, 3, 0.95)',
                    color: '#1a1000',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    padding: '2px 7px',
                    borderRadius: '5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }} title={item.audit_notes || "A képernyőképen nem látható budi/mosdó vagy felülvizsgálatra vár"}>
                    <AlertTriangle size={10} />
                    <span>Kérdéses Kép</span>
                  </span>
                ) : null}
              </div>
            </div>

            <button
              className="btn btn-secondary btn-icon"
              onClick={onClose}
              title="Bezárás"
              style={{ flexShrink: 0, width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.78rem', flexWrap: 'wrap', color: 'var(--text-muted)' }}>
              {item.game_title && item.game_title !== item.video_title && (
                <span style={{ color: 'var(--text-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.video_title}>
                  {item.video_title} •
                </span>
              )}
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                {item.timestamp_formatted} ({Math.floor(item.timestamp_sec || 0)}s)
              </span>
              <span style={{ color: 'var(--text-dim)' }}>•</span>
              <span style={{ color: 'var(--accent-purple)' }}>{item.matched_keyword}</span>
            </div>

            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: '2px', borderRadius: '7px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
              <button
                className={`btn ${viewMode === 'image' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => setViewMode('image')}
              >
                <ImageIcon size={13} />
                <span>Budi Kép</span>
              </button>
              <button
                className={`btn ${viewMode === 'video' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => setViewMode('video')}
              >
                <VideoIcon size={13} />
                <span>Videó</span>
              </button>
            </div>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {viewMode === 'image' ? (
            <div className="modal-media-wrapper">
              <img
                src={item.screenshot_url || '/screenshots/placeholder.jpg'}
                alt={item.video_title}
                className="modal-media-img"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80';
                }}
              />
              <div className="modal-media-caption">
                📸 Képernyőkép a budiról ({item.timestamp_formatted})
              </div>
            </div>
          ) : (
            <div className="video-responsive">
              <iframe
                src={embedUrl}
                title={item.video_title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          )}

          {item.audit_status === 'warning' && (
            <div style={{
              margin: '0.65rem 1.15rem 0 1.15rem',
              padding: '0.55rem 0.8rem',
              background: 'rgba(255, 183, 3, 0.08)',
              border: '1px solid rgba(255, 183, 3, 0.25)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#ffd166',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              lineHeight: 1.4
            }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#ffb703' }} />
              <div>
                <strong>AI Képvizsgálat:</strong> {item.audit_notes || 'A hanganyag valódi értékelés, de a képernyőképen nem látszik tisztán budi vagy fürdőszobai elem.'}
              </div>
            </div>
          )}

          <div style={{ padding: '1rem 1.15rem' }}>
            <div className="card-quote-box" style={{ marginBottom: '0.85rem', fontSize: '0.88rem', lineHeight: '1.45', padding: '0.75rem 0.9rem' }}>
              "{item.quote}"
            </div>

            {/* Jani és Közösség Értékelése */}
            <div className="modal-ratings-grid">
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  👑 Jani értékelése
                </div>
                <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#fff', marginTop: '2px' }}>
                  {rating.toFixed(1)} <span style={{ fontSize: '0.88rem', color: 'var(--text-dim)', fontWeight: 600 }}>/ 10</span>
                </div>
              </div>

              <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  👥 Közösség értékelése
                </div>
                {item.user_votes_count > 0 ? (
                  <div>
                    <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#d8b4fe', marginTop: '2px', lineHeight: 1.1 }}>
                      {item.user_votes_avg?.toFixed(1)} <span style={{ fontSize: '0.88rem', color: 'var(--text-dim)', fontWeight: 600 }}>/ 10</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#c084fc', fontWeight: 600, marginTop: '2px' }}>
                      {item.user_votes_count} ember szavazata alapján
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)', marginTop: '6px' }}>
                    Még nem jött szavazat
                  </div>
                )}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="modal-actions-bar">
              <div className="modal-actions-secondary">
                {onReport && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => onReport(item)}
                    style={{ fontSize: '0.82rem', color: '#ff758f', borderColor: 'rgba(255, 117, 143, 0.35)' }}
                    title="Hibás budi bejelentése az adminnak"
                  >
                    <Bug size={14} />
                    <span>Hibás Budi Bejelentése</span>
                  </button>
                )}

                {onEdit && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => onEdit(item)}
                    style={{ fontSize: '0.82rem' }}
                    title="Budi adatainak szerkesztése (Admin)"
                  >
                    <Edit3 size={14} />
                    <span>Szerkesztés</span>
                  </button>
                )}

                {onDelete && (
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      onDelete(item.id);
                      onClose();
                    }}
                    style={{ fontSize: '0.82rem' }}
                    title="Budi végleges törlése a rangsorból (Admin)"
                  >
                    <Trash2 size={14} />
                    <span>Törlés</span>
                  </button>
                )}
              </div>

              <a
                href={item.yt_timestamp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary modal-btn-youtube"
              >
                <span>Megnyitás YouTube-on</span>
                <ExternalLink size={15} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
