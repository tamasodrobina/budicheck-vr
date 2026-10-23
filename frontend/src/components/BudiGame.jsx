import React, { useState, useEffect, useRef } from 'react';
import { 
  Gamepad2, Sparkles, Trophy, Star, RefreshCw, Play, 
  ExternalLink, ChevronRight, CheckCircle, Flame, Heart, 
  ThumbsUp, ThumbsDown, Eye, Video, Image as ImageIcon
} from 'lucide-react';
import { getScoreBadgeClass } from './BudiCard';

export default function BudiGame({ onPlayItem, isOpen: controlledIsOpen, onToggleOpen }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (val) => {
    if (onToggleOpen) {
      if (typeof val === 'function') {
        onToggleOpen(val(isOpen));
      } else {
        onToggleOpen(val);
      }
    } else {
      setInternalIsOpen(val);
    }
  };

  useEffect(() => {
    const handleOpenEvent = () => {
      setIsOpen(true);
      setTimeout(() => {
        const el = document.getElementById('budi-quiz-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };
    window.addEventListener('open-budi-quiz', handleOpenEvent);
    return () => window.removeEventListener('open-budi-quiz', handleOpenEvent);
  }, []);

  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState(null);
  const [userRating, setUserRating] = useState('7.0');
  const [votedResult, setVotedResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('image'); // Default to toilet photo for instant guessing
  const [voteError, setVoteError] = useState('');
  const [prevVote, setPrevVote] = useState(null);
  const [hpToken, setHpToken] = useState('');
  const loadTimeRef = useRef(Date.now());

  const handleRatingChange = (e) => {
    let val = e.target.value.replace(',', '.');
    if (val === '') {
      setUserRating('');
      return;
    }
    // Accept valid numbers from 0 to 10 with up to 1 decimal place: e.g. "0", "7", "7.", "7.5", "10", "10.0"
    if (/^(10(\.0?)?|[0-9](\.[0-9]?)?)$/.test(val)) {
      setUserRating(val);
    }
  };

  const handleRatingBlur = () => {
    let num = parseFloat(userRating.replace(',', '.'));
    if (isNaN(num) || num < 0) num = 0;
    if (num > 10) num = 10;
    setUserRating(num.toFixed(1));
  };

  const adjustRating = (delta) => {
    let curr = parseFloat(userRating.replace(',', '.')) || 0;
    let next = Math.min(10, Math.max(0, Math.round((curr + delta) * 10) / 10));
    setUserRating(next.toFixed(1));
  };

  const fetchRandomItem = async (excludeId = null) => {
    try {
      setLoading(true);
      setVotedResult(null);
      setVoteError('');
      let url = '/api/game/random';
      if (excludeId) url += `?exclude_id=${excludeId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItem(data);
        loadTimeRef.current = Date.now();
        const stored = localStorage.getItem('budicheck_voted_' + data.id);
        if (stored) {
          setPrevVote(parseFloat(stored));
          setUserRating(stored);
        } else {
          setPrevVote(null);
          setUserRating('7.0');
        }
      } else {
        setItem(null);
      }
    } catch (e) {
      console.error('Failed to fetch game item:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !item) {
      fetchRandomItem();
    }
  }, [isOpen]);

  const handleVote = async () => {
    if (!item || submitting) return;
    try {
      setSubmitting(true);
      setVoteError('');
      const parsedRating = Math.min(10, Math.max(0, Math.round((parseFloat(String(userRating).replace(',', '.')) || 0) * 10) / 10));
      const res = await fetch('/api/game/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_id: item.id,
          rating: parsedRating,
          hp_token: hpToken,
          client_ts: loadTimeRef.current
        })
      });
      if (res.ok) {
        const data = await res.json();
        setVotedResult(data);
        localStorage.setItem('budicheck_voted_' + item.id, String(parsedRating));
        setPrevVote(parsedRating);
      } else {
        const errData = await res.json();
        setVoteError(errData.detail || 'Nem sikerült elküldeni a szavazatot.');
      }
    } catch (e) {
      console.error('Failed to submit vote:', e);
      setVoteError('Hálózati hiba történt a szavazat rögzítésekor.');
    } finally {
      setSubmitting(false);
    }
  };

  const getVerdict = (userR, janiR) => {
    const diff = Math.abs(userR - janiR);
    if (diff === 0) {
      return { text: "🎯 Teljes Telitalálat! Pontosan ugyanannyira értékeled a budit, mint Jani!", color: 'var(--accent-gold)' };
    }
    if (diff <= 1.0) {
      return { text: "🤝 Szinte Tökéletes Egyetértés! Hasonló az ízlésetek Janival.", color: 'var(--accent-cyan)' };
    }
    if (userR > janiR) {
      return { text: "💖 Lágyszívű vagy! Jobbra értékelted ezt a budit, mint Jani.", color: 'var(--accent-green)' };
    }
    return { text: "🧐 Szigorúbb vagy Janinál! Magasabbak a tisztasági és kényelmi elvárásaid.", color: '#ff758f' };
  };

  const getRatingColor = (val) => {
    if (val >= 9.0) return 'var(--accent-gold)';
    if (val >= 7.0) return 'var(--accent-green)';
    if (val >= 4.0) return 'var(--accent-cyan)';
    return 'var(--accent-red)';
  };

  return (
    <div 
      id="budi-quiz-section"
      className="quiz-section quiz-banner"
      style={{
        marginBottom: '2rem',
        borderRadius: '16px',
        overflow: 'hidden',
        border: isOpen ? '1px solid var(--accent-gold)' : '1px solid #1f283d',
        background: '#0f131f',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
        transition: 'all 0.3s'
      }}
    >
      {/* BANNER HEADER */}
      <div 
        className="quiz-banner-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="quiz-banner-left">
          <div 
            className="quiz-banner-icon"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ffb703 0%, #ff4d6d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              boxShadow: '0 4px 15px rgba(255, 183, 3, 0.3)',
              flexShrink: 0
            }}
          >
            🎮
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 className="quiz-banner-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                Budi Kvíz & Közösségi Szavazás
              </h3>
              <span style={{
                background: 'rgba(255, 183, 3, 0.15)',
                color: 'var(--accent-gold)',
                border: '1px solid rgba(255, 183, 3, 0.35)',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase'
              }}>
                Mini-Játék
              </span>
            </div>
            <p className="quiz-banner-desc" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '3px 0 0' }}>
              Nézd meg a videót, szavazz hány pontot ér a budi, és hasonlítsd össze Jani véleményével és a közösséggel!
            </p>
          </div>
        </div>

        <button 
          className="btn quiz-banner-btn"
          style={{ 
            pointerEvents: 'none',
            fontSize: '0.85rem',
            padding: '0.5rem 1rem',
            fontWeight: 700,
            background: isOpen ? '#1e2538' : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            color: isOpen ? '#f1f5f9' : '#040914',
            border: isOpen ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
            boxShadow: isOpen ? '0 2px 8px rgba(0,0,0,0.3)' : '0 4px 15px rgba(0, 242, 254, 0.25)',
            transition: 'all 0.2s ease'
          }}
        >
          {isOpen ? '✕ Kvíz Bezárása' : '▶ Kvíz Indítása'}
        </button>
      </div>

      {/* GAME CONTENT CONTAINER */}
      {isOpen && (
        <div className="quiz-content-body" style={{ borderTop: '1px solid var(--border-color)', padding: '1.75rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <RefreshCw className="spin" size={32} style={{ color: 'var(--accent-gold)' }} />
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Következő budi sorsolása...</p>
            </div>
          ) : !item ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Még nem található mentett budi az adatbázisban a játékhoz.</p>
              <button className="btn btn-secondary" onClick={() => fetchRandomItem()}>
                <RefreshCw size={16} />
                <span>Újrapróbálás</span>
              </button>
            </div>
          ) : (
            <div className="quiz-content-grid">
              {/* MEDIA SIDE (VIDEO OR IMAGE) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Gamepad2 size={18} style={{ color: 'var(--accent-cyan)' }} />
                    <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{item.game_title}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontFamily: 'monospace', marginLeft: '6px' }}>
                      @{item.timestamp_formatted}
                    </span>
                  </div>

                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: '2px', borderRadius: '6px' }}>
                    <button 
                      className={`btn ${viewMode === 'video' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => setViewMode('video')}
                    >
                      <Video size={13} />
                      <span>Klip</span>
                    </button>
                    <button 
                      className={`btn ${viewMode === 'image' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => setViewMode('image')}
                    >
                      <ImageIcon size={13} />
                      <span>Kép</span>
                    </button>
                  </div>
                </div>

                <div style={{
                  position: 'relative',
                  paddingBottom: '56.25%',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#000',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  border: '1px solid var(--border-color)'
                }}>
                  {viewMode === 'video' ? (
                    <iframe
                      key={!votedResult ? 'guessing-clip' : 'full-clip'}
                      src={
                        !votedResult
                          ? `https://www.youtube.com/embed/${item.video_id}?start=${Math.floor(item.timestamp_sec || 0)}&end=${item.verdict_sec ? Math.floor(item.verdict_sec - 1) : Math.floor((item.timestamp_sec || 0) + 11)}&autoplay=1`
                          : `https://www.youtube.com/embed/${item.video_id}?start=${Math.floor(item.timestamp_sec || 0)}&autoplay=1`
                      }
                      title={item.video_title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                    />
                  ) : (
                    <img 
                      src={item.screenshot_url || '/screenshots/placeholder.jpg'} 
                      alt="Budi fotó"
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                  )}
                </div>

                <div style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: !votedResult ? 'var(--accent-gold)' : 'var(--accent-green)',
                    background: !votedResult ? 'rgba(255, 183, 3, 0.1)' : 'rgba(6, 214, 160, 0.1)',
                    border: `1px solid ${!votedResult ? 'rgba(255, 183, 3, 0.3)' : 'rgba(6, 214, 160, 0.3)'}`,
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}>
                    {!votedResult ? '🔒 Spoiler-védelem: A klip leáll a pontszám kimondása előtt!' : '🔓 Spoiler feloldva: Teljes jelenet Janival'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    {item.video_title}
                  </div>
                </div>
              </div>

              {/* INTERACTION / VOTING / RESULTS SIDE */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
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

                {!votedResult ? (
                  <div>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
                      Szerinted hány pontot érdemel?
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      Nézd meg a budi elrendezését, csempézését és hangulatát! Add meg a pontszámod a 0-10 skálán:
                    </p>

                    {prevVote !== null && (
                      <div style={{
                        background: 'rgba(0, 242, 254, 0.1)',
                        border: '1px solid rgba(0, 242, 254, 0.3)',
                        color: 'var(--accent-cyan)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        marginBottom: '1.2rem',
                        textAlign: 'center'
                      }}>
                        ℹ️ Erre a budira már szavaztál korábban (<strong>{prevVote} pont</strong>). Új pontszámmal módosíthatod a szavazatodat!
                      </div>
                    )}

                    {voteError && (
                      <div style={{
                        background: 'rgba(255, 77, 109, 0.15)',
                        border: '1px solid rgba(255, 77, 109, 0.4)',
                        color: '#ff4d6d',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        marginBottom: '1rem',
                        textAlign: 'center'
                      }}>
                        ⚠️ {voteError}
                      </div>
                    )}

                    {/* DIRECT TYPED INPUT FIELD (0.0 - 10.0, 1 decimal place) */}
                    <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.8rem',
                        background: '#090d16',
                        padding: '0.65rem 1.25rem',
                        borderRadius: '16px',
                        border: '1px solid #1f273d'
                      }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => adjustRating(-0.5)}
                          style={{ width: '42px', height: '42px', padding: 0, fontSize: '1.4rem', fontWeight: 800 }}
                          title="-0.5 pont"
                        >
                          -
                        </button>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={userRating}
                            onChange={handleRatingChange}
                            onBlur={handleRatingBlur}
                            placeholder="7.0"
                            style={{
                              width: '125px',
                              height: '56px',
                              fontSize: '2.5rem',
                              fontWeight: 900,
                              textAlign: 'center',
                              color: getRatingColor(parseFloat(userRating) || 0),
                              background: '#121726',
                              border: `2px solid ${getRatingColor(parseFloat(userRating) || 0)}`,
                              borderRadius: '12px',
                              outline: 'none',
                              fontFamily: 'var(--font-heading)',
                              boxShadow: `0 0 18px ${getRatingColor(parseFloat(userRating) || 0)}33`
                            }}
                          />
                          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-dim)' }}>
                            / 10
                          </span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => adjustRating(0.5)}
                          style={{ width: '42px', height: '42px', padding: 0, fontSize: '1.4rem', fontWeight: 800 }}
                          title="+0.5 pont"
                        >
                          +
                        </button>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                        ⌨️ Írj be közvetlenül egy számot <strong>0 és 10 között, 1 tizedesig</strong> (pl. 8.5 vagy 9.2)!
                      </div>
                    </div>

                    {/* QUICK SELECTION PILLS */}
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                      {[1.0, 3.0, 5.0, 7.0, 8.5, 9.5, 10.0].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setUserRating(num.toFixed(1))}
                          style={{
                            background: parseFloat(userRating) === num ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${parseFloat(userRating) === num ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                            color: parseFloat(userRating) === num ? 'var(--accent-cyan)' : 'var(--text-muted)',
                            padding: '0.3rem 0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {num.toFixed(1)}p
                        </button>
                      ))}
                    </div>

                    {/* SUBMIT VOTE BUTTON */}
                    <button
                      className="btn btn-primary"
                      onClick={handleVote}
                      disabled={submitting}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '0.85rem',
                        fontSize: '1rem',
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #ffb703 0%, #ff4d6d 100%)',
                        boxShadow: '0 4px 18px rgba(255, 183, 3, 0.35)',
                        border: 'none',
                        color: '#000'
                      }}
                    >
                      <Sparkles size={18} />
                      <span>{submitting ? 'Szavazat rögzítése...' : (prevVote !== null ? '🔄 Szavazatom Módosítása' : '⭐ Szavazok & Jani Értékelésének Felfedése!')}</span>
                    </button>
                  </div>
                ) : (
                  /* REVEALED RESULTS VIEW */
                  <div>
                    {votedResult.is_updated && (
                      <div style={{
                        background: 'rgba(6, 214, 160, 0.15)',
                        border: '1px solid var(--accent-green)',
                        color: 'var(--accent-green)',
                        padding: '0.5rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        marginBottom: '0.85rem',
                        textAlign: 'center'
                      }}>
                        ✨ A korábbi szavazatodat sikeresen frissítettük a közösségi rangsorban!
                      </div>
                    )}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '1rem',
                      borderRadius: '10px',
                      marginBottom: '1.25rem',
                      textAlign: 'center',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Összehasonlítás Janival
                      </div>
                      <div style={{
                        marginTop: '0.4rem',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: getVerdict(votedResult.user_rating, votedResult.jani_rating).color
                      }}>
                        {getVerdict(votedResult.user_rating, votedResult.jani_rating).text}
                      </div>
                    </div>

                    {/* 3 SCORE CARDS */}
                    <div className="quiz-score-grid">
                      {/* USER SCORE */}
                      <div className="quiz-score-card" style={{ background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.3)', padding: '0.85rem 0.5rem', borderRadius: '10px' }}>
                        <div className="score-title" style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 800, textTransform: 'uppercase' }}>Te Szavazatod</div>
                        <div className="score-val" style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--accent-cyan)', marginTop: '2px' }}>
                          {votedResult.user_rating.toFixed(1)}
                        </div>
                      </div>

                      {/* JANI SCORE */}
                      <div className="quiz-score-card" style={{ background: 'rgba(255, 183, 3, 0.12)', border: '1px solid rgba(255, 183, 3, 0.4)', padding: '0.85rem 0.5rem', borderRadius: '10px' }}>
                        <div className="score-title" style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 800, textTransform: 'uppercase' }}>👑 Jani Értékelése</div>
                        <div className="score-val" style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--accent-gold)', marginTop: '2px' }}>
                          {votedResult.jani_rating.toFixed(1)}
                        </div>
                      </div>

                      {/* COMMUNITY AVG */}
                      <div className="quiz-score-card" style={{ background: 'rgba(157, 78, 221, 0.08)', border: '1px solid rgba(157, 78, 221, 0.3)', padding: '0.85rem 0.5rem', borderRadius: '10px' }}>
                        <div className="score-title" style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', fontWeight: 800, textTransform: 'uppercase' }}>👥 Közösség ({votedResult.votes_count})</div>
                        <div className="score-val" style={{ fontSize: '1.6rem', fontWeight: 900, color: '#d8b4fe', marginTop: '2px' }}>
                          {votedResult.community_avg?.toFixed(1) || votedResult.user_rating.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* JANI'S QUOTE */}
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      padding: '1rem',
                      borderRadius: '8px',
                      borderLeft: '3px solid var(--accent-gold)',
                      fontSize: '0.9rem',
                      fontStyle: 'italic',
                      color: 'var(--text-main)',
                      marginBottom: '1.5rem',
                      lineHeight: '1.5'
                    }}>
                      "{votedResult.quote || 'Nem volt részletezett szöveges megjegyzés.'}"
                    </div>

                    {/* NEXT RANDOM BUTTON */}
                    <button
                      className="btn btn-primary"
                      onClick={() => fetchRandomItem(item.id)}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '0.8rem',
                        fontSize: '0.95rem',
                        fontWeight: 700
                      }}
                    >
                      <RefreshCw size={16} />
                      <span>Következő Budi Sorsolása 🎲</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
