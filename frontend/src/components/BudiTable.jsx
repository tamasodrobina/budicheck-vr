import { Play, ExternalLink, Edit3, Trash2, Users, Bug, CheckCircle } from 'lucide-react';
import { getScoreBadgeClass } from './BudiCard';

export default function BudiTable({ items, onPlay, onEdit, onDelete, onReport }) {
  const showAdminActions = Boolean(onEdit && onDelete);

  return (
    <div className="table-container">
      <table className="budi-table">
        <thead>
          <tr>
            <th>Értékelés</th>
            <th>Kép</th>
            <th>Játék / Videó</th>
            <th>Időbélyeg</th>
            <th>Mit mondott róla</th>
            <th>Műveletek</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: '#94a3b8' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '0.6rem' }}>🚽</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>Még nincs rögzített budi értékelés</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px' }}>
                  Az adatbázis jelenleg üres.
                </div>
              </td>
            </tr>
          ) : (
            items.map((item) => {
            const badgeClass = getScoreBadgeClass(item.rating || 0);
            return (
              <tr key={item.id}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', fontWeight: 800, textTransform: 'uppercase' }}>
                      👑 Jani értékelése
                    </div>
                    <span className={`score-badge ${badgeClass}`} style={{ marginBottom: '4px' }}>
                      {item.rating?.toFixed(1)} / 10
                    </span>

                    <div style={{ fontSize: '0.68rem', color: '#c084fc', fontWeight: 800, textTransform: 'uppercase' }}>
                      👥 Közösség értékelése
                    </div>
                    {item.user_votes_count > 0 ? (
                      <span style={{
                        background: 'rgba(157, 78, 221, 0.2)',
                        border: '1px solid rgba(157, 78, 221, 0.4)',
                        color: '#d8b4fe',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }} title={`Közösségi átlag: ${item.user_votes_avg} (${item.user_votes_count} szavazat)`}>
                        <Users size={11} />
                        <span>{item.user_votes_avg?.toFixed(1)} / 10 ({item.user_votes_count} szavazat)</span>
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-dim)',
                        fontStyle: 'italic'
                      }}>
                        Még nem jött szavazat
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <img
                    src={item.screenshot_url || '/screenshots/placeholder.jpg'}
                    alt="Budi"
                    className="table-thumb"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onPlay(item)}
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=300&q=80';
                    }}
                  />
                </td>
                <td>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                    {item.game_title || item.video_title}
                  </div>
                  {item.game_title && item.game_title !== item.video_title && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {item.video_title}
                    </div>
                  )}
                </td>
                <td>
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                    {item.timestamp_formatted}
                  </span>
                </td>
                <td style={{ maxWidth: '380px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    "{item.quote}"
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      className="btn btn-primary btn-icon"
                      style={{ padding: '0.4rem' }}
                      onClick={() => onPlay(item)}
                      title="Lejátszás"
                    >
                      <Play size={15} />
                    </button>
                    <a
                      href={item.yt_timestamp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-icon"
                      style={{ padding: '0.4rem' }}
                      title="Megnyitás YouTube-on"
                    >
                      <ExternalLink size={15} />
                    </a>
                    {onReport && (
                      <button
                        className="btn btn-secondary btn-icon"
                        style={{ padding: '0.4rem', color: '#ff758f' }}
                        onClick={() => onReport(item)}
                        title="Hibás budi bejelentése"
                      >
                        <Bug size={15} />
                      </button>
                    )}
                    {showAdminActions && (
                      <>
                        <button
                          className="btn btn-secondary btn-icon"
                          style={{ padding: '0.4rem' }}
                          onClick={() => onEdit(item)}
                          title="Szerkesztés"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          className="btn btn-danger btn-icon"
                          style={{ padding: '0.4rem' }}
                          onClick={() => onDelete(item.id)}
                          title="Törlés"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
      </table>
    </div>
  );
}
