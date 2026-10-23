import React from 'react';
import { Play, Sparkles, Clock, Gamepad2, Info, Users, HelpCircle } from 'lucide-react';

export const TIERS = [
  {
    id: 'S',
    name: 'Istenkirály Trón',
    range: '9.0 - 10.0',
    min: 9.0,
    max: 10.0,
    color: '#FF4B3E',
    glow: 'rgba(255, 75, 62, 0.4)',
    textColor: '#FFFFFF',
    desc: 'Tökéletes tisztaság, működő csap, budipapír és pazar élmény.'
  },
  {
    id: 'A',
    name: 'Nagyon Jó',
    range: '8.0 - 8.9',
    min: 8.0,
    max: 8.99,
    color: '#FF9800',
    glow: 'rgba(255, 152, 0, 0.4)',
    textColor: '#FFFFFF',
    desc: 'Tiszta, kulturált és rendben lévő budi.'
  },
  {
    id: 'B',
    name: 'Korrekt Budi',
    range: '6.5 - 7.9',
    min: 6.5,
    max: 7.99,
    color: '#FFD600',
    glow: 'rgba(255, 214, 0, 0.4)',
    textColor: '#000000',
    desc: 'Átlagos vécé, kisebb hibákkal, de használható.'
  },
  {
    id: 'C',
    name: 'Elfogadható',
    range: '5.0 - 6.4',
    min: 5.0,
    max: 6.49,
    color: '#06D6A0',
    glow: 'rgba(6, 214, 160, 0.4)',
    textColor: '#000000',
    desc: 'Szükség esetén elmegy, de van mit javítani rajta.'
  },
  {
    id: 'D',
    name: 'Kérdéses / Retkes',
    range: '3.5 - 4.9',
    min: 3.5,
    max: 4.99,
    color: '#00F2FE',
    glow: 'rgba(0, 242, 254, 0.4)',
    textColor: '#000000',
    desc: 'Koszos, lehúzhatatlan vagy hiányos felszereltség.'
  },
  {
    id: 'E',
    name: 'Nagyon Gáz',
    range: '2.0 - 3.4',
    min: 2.0,
    max: 3.49,
    color: '#B388FF',
    glow: 'rgba(179, 136, 255, 0.4)',
    textColor: '#000000',
    desc: 'Büdös, undorító, csak saját felelősségre.'
  },
  {
    id: 'F',
    name: 'Katasztrófa',
    range: '0.0 - 1.9',
    min: 0.0,
    max: 1.99,
    color: '#FF2A6D',
    glow: 'rgba(255, 42, 109, 0.4)',
    textColor: '#FFFFFF',
    desc: 'Teljes fertőzésveszély, azonnal menekülj!'
  }
];

export default function TierListView({ checks, onSelectCheck, isCommunityMode = false, onReport, onOpenQuiz }) {
  const getChecksForTier = (tier) => {
    return checks.filter((c) => {
      const r = isCommunityMode 
        ? (c.user_votes_count > 0 ? Number(c.user_votes_avg) : -1)
        : Number(c.rating || 0);
      if (r < 0) return false;
      return r >= tier.min && r <= tier.max;
    });
  };

  const unvotedChecks = isCommunityMode 
    ? checks.filter((c) => !c.user_votes_count || c.user_votes_count === 0)
    : [];

  const totalCommunityVotes = checks.reduce((sum, c) => sum + (c.user_votes_count || 0), 0);
  const votedChecksCount = checks.filter((c) => (c.user_votes_count || 0) > 0).length;

  return (
    <div className="tierlist-container" style={{ margin: '1.5rem 0' }}>
      {/* Tierlist Header Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.8rem',
        padding: '0 0.5rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{isCommunityMode ? '👥' : '🏆'}</span>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
            {isCommunityMode
              ? 'Közösségi BudiCheck Rangsor (Tier List)'
              : 'TheVR Jani BudiCheck Rangsor (Tier List)'}
          </h2>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
          Kattints bármelyik budira a videójelenet és a részletes idézet megnyitásához!
        </span>
      </div>

      {/* Community Stats Banner when in Community Mode */}
      {isCommunityMode && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
          background: 'linear-gradient(135deg, rgba(157, 78, 221, 0.18) 0%, rgba(90, 24, 154, 0.12) 100%)',
          border: '1px solid rgba(157, 78, 221, 0.35)',
          borderRadius: '11px',
          padding: '0.8rem 1.2rem',
          marginBottom: '1rem',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 24px rgba(157, 78, 221, 0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                background: 'rgba(157, 78, 221, 0.28)',
                border: '1px solid rgba(216, 180, 254, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d8b4fe',
                flexShrink: 0
              }}>
                <Users size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#c084fc', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                  Összes Leadott Szavazat
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                  {totalCommunityVotes}{' '}
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)' }}>voks a közösségtől</span>
                </div>
              </div>
            </div>

            <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '1.25rem' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                Értékelt Budik Aránya
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                {votedChecksCount}{' '}
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                  / {checks.length} db ({Math.round((votedChecksCount / (checks.length || 1)) * 100)}%)
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#ffd166', fontWeight: 600 }}>
              🎮 Befolyásold te is a rangsort!
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (onOpenQuiz) {
                  onOpenQuiz();
                } else {
                  window.dispatchEvent(new CustomEvent('open-budi-quiz'));
                  const el = document.getElementById('budi-quiz-section') || document.querySelector('.quiz-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              style={{
                fontSize: '0.78rem',
                padding: '0.4rem 0.85rem',
                background: 'rgba(255, 183, 3, 0.15)',
                borderColor: 'rgba(255, 183, 3, 0.45)',
                color: 'var(--accent-gold)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>Ugrás a Kvízhez</span>
              <span>⬆️</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Tierlist Frame matching the layout */}
      <div
        className="tierlist-frame"
        style={{
          border: '3px solid #11141d',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          background: '#0d1017'
        }}
      >
        {TIERS.map((tier, idx) => {
          const tierChecks = getChecksForTier(tier);

          return (
            <div
              key={tier.id}
              className="tierlist-row"
              style={{
                display: 'flex',
                borderBottom: '2px solid #11141d',
                minHeight: '115px'
              }}
            >
              {/* Left Colored Badge Column */}
              <div
                className="tier-badge-col"
                style={{
                  background: tier.color,
                  color: tier.textColor
                }}
              >
                <span className="tier-letter">
                  {tier.id}
                </span>
                <span className="tier-range">
                  {tier.range}
                </span>
                <span className="tier-name">
                  {tier.name}
                </span>
              </div>

              {/* Right Horizontal Items Container */}
              <div className="tier-items-col">
                {tierChecks.length > 0 ? (
                  tierChecks.map((item) => {
                    const gameName = item.game_title || item.video_title || 'Ismeretlen játék';

                    return (
                      <div
                        key={item.id}
                        className="tier-item-card"
                        onClick={() => onSelectCheck(item)}
                        style={{
                          borderRadius: '7px',
                          position: 'relative',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: `1.5px solid rgba(255,255,255,0.12)`,
                          background: '#090b10',
                          transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.08) translateY(-3px)';
                          e.currentTarget.style.boxShadow = `0 10px 25px rgba(0,0,0,0.85), 0 0 16px ${tier.glow}`;
                          e.currentTarget.style.zIndex = '10';
                          e.currentTarget.style.borderColor = tier.color;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1) translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.zIndex = '1';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                        }}
                        title={`${gameName} | 👑 Jani értékelése: ${Number(item.rating).toFixed(1)}/10 | 👥 Közösség értékelése: ${item.user_votes_count > 0 ? `${item.user_votes_avg?.toFixed(1)}/10 (${item.user_votes_count} szavazat)` : 'Még nem jött szavazat'}`}
                      >
                        {/* Toilet Screenshot */}
                        <img
                          src={item.screenshot_url || '/screenshots/placeholder.jpg'}
                          alt={gameName}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block'
                          }}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80';
                          }}
                        />

                        {/* Play Hover Overlay */}
                        <div
                          className="tier-card-play-overlay"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                        >
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'var(--accent-cyan)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#000',
                              boxShadow: '0 0 12px var(--accent-cyan)'
                            }}
                          >
                            <Play size={16} style={{ marginLeft: '2px' }} />
                          </div>
                        </div>

                        {/* Badges on Top Right: Primary according to mode */}
                        <div style={{ position: 'absolute', top: '5px', right: '5px', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end', zIndex: 3 }}>
                          {isCommunityMode ? (
                            <>
                              {/* Primary: Community */}
                              <div
                                style={{
                                  background: 'rgba(157, 78, 221, 0.95)',
                                  border: `1px solid ${tier.color}`,
                                  borderRadius: '4px',
                                  padding: '1px 5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  color: '#fff',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                                }}
                                title={`Közösség értékelése: ${item.user_votes_avg?.toFixed(1)}/10 (${item.user_votes_count} ember szavazata alapján)`}
                              >
                                <Users size={10} />
                                <span>{item.user_votes_avg?.toFixed(1)}</span>
                                <span style={{ fontSize: '0.62rem', opacity: 0.85, fontWeight: 600 }}>({item.user_votes_count})</span>
                              </div>
                              {/* Secondary: Jani */}
                              <div
                                style={{
                                  background: 'rgba(0, 0, 0, 0.85)',
                                  border: '1px solid rgba(255, 183, 3, 0.5)',
                                  borderRadius: '4px',
                                  padding: '1px 4px',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  color: 'var(--accent-gold)'
                                }}
                                title={`Jani értékelése: ${Number(item.rating).toFixed(1)}/10`}
                              >
                                <span>👑 {Number(item.rating).toFixed(1)}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Primary: Jani */}
                              <div
                                style={{
                                  background: 'rgba(0, 0, 0, 0.85)',
                                  border: `1px solid ${tier.color}`,
                                  borderRadius: '4px',
                                  padding: '1px 5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  color: tier.color,
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                                }}
                                title={`Jani értékelése: ${Number(item.rating).toFixed(1)}/10`}
                              >
                                <Sparkles size={10} />
                                <span>{Number(item.rating).toFixed(1)}</span>
                              </div>
                              {/* Secondary: Community if present */}
                              {item.user_votes_count > 0 ? (
                                <div
                                  style={{
                                    background: 'rgba(157, 78, 221, 0.9)',
                                    border: '1px solid rgba(216, 180, 254, 0.4)',
                                    borderRadius: '4px',
                                    padding: '1px 4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    fontSize: '0.66rem',
                                    fontWeight: 800,
                                    color: '#fff'
                                  }}
                                  title={`Közösségi átlag: ${item.user_votes_avg?.toFixed(1)}/10 (${item.user_votes_count} ember szavazata alapján)`}
                                >
                                  <Users size={9} />
                                  <span>{item.user_votes_avg?.toFixed(1)}</span>
                                  <span style={{ fontSize: '0.58rem', opacity: 0.85 }}>({item.user_votes_count})</span>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>

                        {/* Timestamp Badge (Top Left) */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '5px',
                            left: '5px',
                            background: 'rgba(0, 0, 0, 0.75)',
                            borderRadius: '4px',
                            padding: '1px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)'
                          }}
                        >
                          <Clock size={9} />
                          <span>{item.timestamp_formatted}</span>
                        </div>

                        {/* Game Title Bar (Bottom) */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)',
                            padding: '12px 6px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Gamepad2 size={12} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#ffffff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              letterSpacing: '0.2px'
                            }}
                          >
                            {gameName}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      color: 'rgba(255, 255, 255, 0.18)',
                      fontSize: '0.82rem',
                      fontStyle: 'italic',
                      padding: '0.5rem 0.2rem',
                      userSelect: 'none'
                    }}
                  >
                    Nincs még budi ebben a kategóriában ({tier.name})
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* In Community Mode: Extra row for budis waiting for community votes */}
        {isCommunityMode && (
          <div
            className="tierlist-row"
            style={{
              display: 'flex',
              background: '#090d18',
              minHeight: '115px'
            }}
          >
            {/* Left Column for Unrated */}
            <div
              className="tier-badge-col"
              style={{
                background: '#1e2436',
                color: '#94a3b8'
              }}
            >
              <span className="tier-letter" style={{ fontSize: '1.8rem' }}>⏳</span>
              <span className="tier-range" style={{ color: '#fff', textAlign: 'center', lineHeight: '1.2' }}>
                Még Nem Szavazott
              </span>
              <span className="tier-name" style={{ color: 'var(--text-dim)' }}>
                {unvotedChecks.length} db
              </span>
            </div>

            {/* Right container for unvoted budis */}
            <div className="tier-items-col" style={{ background: '#0b0f1a' }}>
              {unvotedChecks.length > 0 ? (
                unvotedChecks.map((item) => {
                  const gameName = item.game_title || item.video_title || 'Ismeretlen játék';
                  return (
                    <div
                      key={item.id}
                      className="tier-item-card"
                      onClick={() => onSelectCheck(item)}
                      style={{
                        borderRadius: '7px',
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '1.5px dashed rgba(255,255,255,0.18)',
                        background: '#090b10',
                        transition: 'all 0.22s ease'
                      }}
                      title={`${gameName} | 👑 Jani: ${Number(item.rating).toFixed(1)}/10 | 👥 Közösség: Még nem jött szavazat (Kvízben szavazhatsz rá!)`}
                    >
                      <img
                        src={item.screenshot_url || '/screenshots/placeholder.jpg'}
                        alt={gameName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80';
                        }}
                      />

                      {/* Jani Score badge */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          background: 'rgba(0, 0, 0, 0.85)',
                          border: '1px solid rgba(255, 183, 3, 0.4)',
                          borderRadius: '4px',
                          padding: '1px 5px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: 'var(--accent-gold)'
                        }}
                      >
                        👑 {Number(item.rating).toFixed(1)}
                      </div>

                      {/* Még nem jött szavazat badge */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '5px',
                          left: '5px',
                          background: 'rgba(157, 78, 221, 0.8)',
                          borderRadius: '4px',
                          padding: '1px 5px',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          color: '#fff'
                        }}
                      >
                        Még nem jött szavazat
                      </div>

                      {/* Game Title */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)',
                          padding: '12px 6px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Gamepad2 size={12} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {gameName}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  🎉 Minden budira érkezett már közösségi szavazat!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
