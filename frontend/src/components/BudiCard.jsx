import React from 'react';
import { Play, ExternalLink, Edit3, Trash2, Clock, Sparkles, Gamepad2, Users, Bug, CheckCircle, AlertTriangle } from 'lucide-react';

export function getScoreBadgeClass(rating) {
  if (rating >= 9.0) return 'score-masterpiece';
  if (rating >= 7.0) return 'score-good';
  if (rating >= 4.0) return 'score-average';
  return 'score-bad';
}

export default function BudiCard({ item, onPlay, onEdit, onDelete, onReport }) {
  const rating = item.rating || 0;
  const badgeClass = getScoreBadgeClass(rating);

  return (
    <div className="glass-panel budi-card">
      <div className="card-media" onClick={() => onPlay(item)}>
        <img
          src={item.screenshot_url || '/screenshots/placeholder.jpg'}
          alt={item.video_title}
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80';
          }}
        />

        <div className="card-media-play">
          <div className="play-button-circle">
            <Play size={22} style={{ marginLeft: '3px' }} />
          </div>
        </div>

        {/* Top-left: Timestamp & Verified status */}
        <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px', alignItems: 'center', zIndex: 2 }}>
          <div className="card-timestamp-badge" style={{ position: 'static' }}>
            <Clock size={13} />
            <span>{item.timestamp_formatted}</span>
          </div>

          {item.is_verified ? (
            <div style={{
              background: 'rgba(6, 214, 160, 0.95)',
              color: '#021811',
              fontWeight: 800,
              fontSize: '0.68rem',
              padding: '2px 6px',
              borderRadius: '5px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
            }} title="Admin és AI által igazolt, hiteles BudiCheck">
              <CheckCircle size={10} />
              <span>Igazolt</span>
            </div>
          ) : item.audit_status === 'warning' ? (
            <div style={{
              background: 'rgba(255, 183, 3, 0.95)',
              color: '#1a1000',
              fontWeight: 800,
              fontSize: '0.68rem',
              padding: '2px 6px',
              borderRadius: '5px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
            }} title={item.audit_notes || "A képernyőképen nem látható budi/mosdó vagy felülvizsgálatra vár"}>
              <AlertTriangle size={10} />
              <span>Kérdéses Kép</span>
            </div>
          ) : null}
        </div>

        {/* Top-right: Scores */}
        <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', zIndex: 2 }}>
          <div className={`score-badge ${badgeClass} card-score-badge`} style={{ position: 'static' }} title="Jani értékelése">
            <Sparkles size={14} />
            <span>👑 {rating.toFixed(1)} / 10</span>
          </div>

          {item.user_votes_count > 0 ? (
            <div style={{
              background: 'rgba(157, 78, 221, 0.9)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(216, 180, 254, 0.4)',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }} title={`Közösségi átlag: ${item.user_votes_avg?.toFixed(1)}/10 (${item.user_votes_count} szavazat)`}>
              <Users size={12} />
              <span>👥 {item.user_votes_avg?.toFixed(1)} ({item.user_votes_count})</span>
            </div>
          ) : (
            <div style={{
              background: 'rgba(0, 0, 0, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-dim)',
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }} title="Erre a budira még nem érkezett szavazat. A fenti Kvízben szavazhatsz rá!">
              <Users size={11} />
              <span>👥 Még nincs szavazat</span>
            </div>
          )}
        </div>
      </div>

      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <Gamepad2 size={15} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
          <h3 className="card-title" style={{ margin: 0 }} title={item.game_title || item.video_title}>
            {item.game_title || item.video_title}
          </h3>
        </div>

        {item.game_title && item.game_title !== item.video_title && (
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginBottom: '0.6rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={item.video_title}
          >
            {item.video_title}
          </div>
        )}

        {/* Jani és Közösség Értékelése */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.6rem',
          margin: '0.75rem 0 0.85rem',
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '0.65rem 0.85rem'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              👑 Jani értékelése
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff', marginTop: '2px' }}>
              {rating.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>/ 10</span>
            </div>
          </div>

          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '0.7rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              👥 Közösség értékelése
            </div>
            {item.user_votes_count > 0 ? (
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#d8b4fe', marginTop: '2px' }}>
                {item.user_votes_avg?.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>/ 10</span>
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', marginTop: '6px' }}>
                Még nem jött szavazat
              </div>
            )}
          </div>
        </div>

        <div className="card-quote-box">
          "{item.quote || 'Nem volt szöveges értékelés részletezve.'}"
        </div>

        <div className="card-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <a
              href={item.yt_timestamp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="youtube-link"
              onClick={(e) => e.stopPropagation()}
            >
              <span>Ugrás YouTube-on</span>
              <ExternalLink size={14} />
            </a>

            {onReport && (
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                style={{ padding: '0.35rem', color: '#ff758f' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onReport(item);
                }}
                title="Hibás budi kártya bejelentése az adminnak"
              >
                <Bug size={14} />
              </button>
            )}
          </div>

          {onEdit && onDelete && (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                className="btn btn-secondary btn-icon"
                style={{ padding: '0.35rem' }}
                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                title="Szerkesztés (Admin)"
              >
                <Edit3 size={15} />
              </button>
              <button
                className="btn btn-danger btn-icon"
                style={{ padding: '0.35rem' }}
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                title="Törlés (Admin)"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
