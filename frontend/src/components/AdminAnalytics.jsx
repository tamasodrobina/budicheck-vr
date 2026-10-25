import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, Users, Eye, Zap, 
  Monitor, Smartphone, Tablet, RefreshCw, Trash2, Shield, 
  Globe, Calendar, Clock, AlertCircle, Gamepad2, Video, Search, MessageSquare,
  ShieldCheck, ShieldOff
} from 'lucide-react';
import { isTrackingIgnored, setTrackingIgnored } from '../utils/analytics';

export default function AdminAnalytics({ token, onPlayItem }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(null);
  const [ignoreAdminTracking, setIgnoreAdminTracking] = useState(() => isTrackingIgnored());

  // Automatically ensure this admin's browser is excluded
  useEffect(() => {
    if (!isTrackingIgnored()) {
      setTrackingIgnored(true);
      setIgnoreAdminTracking(true);
    }
  }, []);

  const fetchAnalytics = async (selectedDays = days) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${selectedDays}`, {
        headers: { 'x-admin-token': token }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Nem sikerült betölteni az analitikai adatokat.');
      }
    } catch (e) {
      setError('Hálózati hiba a statisztikák lekérésekor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(days);
  }, [days, token]);

  const handleReset = async () => {
    if (!window.confirm('Biztosan törölni és nullázni szeretnéd az összes látogatottsági és esemény statisztikát?\n(A jelenlegi adatokról automatikusan biztonsági mentés készül: data/analytics.backup.json)')) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/admin/analytics/reset', {
        method: 'POST',
        headers: { 'x-admin-token': token }
      });
      if (res.ok) {
        alert('✅ Statisztikák sikeresen alaphelyzetbe állítva!');
        fetchAnalytics(days);
      } else {
        alert('Nem sikerült a statisztikák törlése.');
      }
    } catch (e) {
      alert('Hálózati hiba.');
    } finally {
      setResetting(false);
    }
  };

  // Event icon helper
  const getEventIcon = (type) => {
    switch (type) {
      case 'pageview':
        return <Eye size={14} style={{ color: 'var(--accent-cyan)' }} />;
      case 'quiz_start':
      case 'quiz_guess':
        return <Gamepad2 size={14} style={{ color: 'var(--accent-gold)' }} />;
      case 'budi_vote':
        return <Zap size={14} style={{ color: '#ff70a6' }} />;
      case 'video_play':
        return <Video size={14} style={{ color: '#06d6a0' }} />;
      case 'search':
        return <Search size={14} style={{ color: 'var(--accent-cyan)' }} />;
      case 'report_create':
        return <MessageSquare size={14} style={{ color: 'var(--accent-red)' }} />;
      default:
        return <Zap size={14} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  if (loading && !data) {
    return (
      <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <RefreshCw className="spin" size={36} style={{ color: 'var(--accent-cyan)', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Látogatottsági adatok betöltése...</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Adatbázis aggregáció és látogatói mutatók kiszámítása folyamatban
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', borderColor: 'rgba(255, 77, 109, 0.4)' }}>
        <AlertCircle size={36} style={{ color: 'var(--accent-red)', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--accent-red)' }}>Hiba történt</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => fetchAnalytics(days)} style={{ marginTop: '1.5rem' }}>
          <RefreshCw size={14} />
          <span>Újrapróbálás</span>
        </button>
      </div>
    );
  }

  const chartData = data?.chart_data || [];
  const maxViews = Math.max(...chartData.map(d => d.pageviews), 5);
  const today = data?.today || { pageviews: 0, unique_visitors: 0, events: 0, trend_pct: 0 };
  const yesterday = data?.yesterday || { pageviews: 0, unique_visitors: 0 };
  const last7 = data?.last_7_days || { pageviews: 0, unique_visitors: 0, daily_avg_views: 0 };
  const allTime = data?.all_time || { pageviews: 0, total_events: 0 };
  const deviceStats = data?.device_stats || { desktop: 0, mobile: 0, tablet: 0, desktop_pct: 100, mobile_pct: 0, tablet_pct: 0 };
  const topReferrers = data?.top_referrers || [];
  const topEvents = data?.top_events || [];
  const recentActivity = data?.recent_activity || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* HEADER & TIME FILTER BAR */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={22} style={{ color: 'var(--accent-cyan)' }} />
                <span>Látogatottság & Közösségi Aktivitás</span>
              </h2>
              <span style={{
                background: 'rgba(6, 214, 160, 0.15)',
                color: 'var(--accent-green)',
                border: '1px solid rgba(6, 214, 160, 0.4)',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Shield size={12} />
                GDPR Cookieless
              </span>

              <button
                type="button"
                onClick={() => {
                  const next = !ignoreAdminTracking;
                  setIgnoreAdminTracking(next);
                  setTrackingIgnored(next);
                }}
                style={{
                  background: ignoreAdminTracking ? 'rgba(6, 214, 160, 0.18)' : 'rgba(255, 77, 109, 0.18)',
                  color: ignoreAdminTracking ? 'var(--accent-green)' : 'var(--accent-red)',
                  border: `1px solid ${ignoreAdminTracking ? 'rgba(6, 214, 160, 0.45)' : 'rgba(255, 77, 109, 0.45)'}`,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title="Kattints a váltáshoz: garantálja, hogy a te teszteléseid és látogatásaid erről az eszközről sosem kerülnek a statisztikába"
              >
                {ignoreAdminTracking ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
                <span>{ignoreAdminTracking ? '🛡️ Saját böngésződ kizárva' : '⚠️ Saját mérés aktív!'}</span>
              </button>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Teljesen beépített, privát analitika: nincs külső hirdetéskövető, nem tárol személyes IP-címet.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)'
            }}>
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  style={{
                    background: days === d ? 'var(--accent-cyan)' : 'transparent',
                    color: days === d ? '#000' : 'var(--text-muted)',
                    fontWeight: days === d ? 800 : 600,
                    fontSize: '0.8rem',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {d} nap
                </button>
              ))}
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => fetchAnalytics(days)}
              disabled={loading}
              title="Adatok azonnali frissítése"
              style={{ padding: '0.55rem 0.9rem' }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Frissítés</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOP 4 KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {/* Card 1: Mai látogatottság */}
        <div className="glass-panel" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, var(--accent-cyan), #3a86ff)'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mai Látogatottság
            </span>
            <div style={{
              background: 'rgba(0, 240, 255, 0.12)',
              color: 'var(--accent-cyan)',
              padding: '6px',
              borderRadius: '8px'
            }}>
              <Eye size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', marginTop: '6px' }}>
            {today.pageviews} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>megtekintés</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Users size={14} />
              {today.unique_visitors} egyedi látogató
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{
              color: today.trend_pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '0.8rem'
            }}>
              {today.trend_pct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {today.trend_pct >= 0 ? `+${today.trend_pct}%` : `${today.trend_pct}%`}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Tegnap: {yesterday.pageviews} megtekintés ({yesterday.unique_visitors} egyedi)
          </div>
        </div>

        {/* Card 2: Heti összesítés */}
        <div className="glass-panel" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, var(--accent-gold), #ffbe0b)'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Elmúlt 7 Nap
            </span>
            <div style={{
              background: 'rgba(255, 183, 3, 0.12)',
              color: 'var(--accent-gold)',
              padding: '6px',
              borderRadius: '8px'
            }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', marginTop: '6px' }}>
            {last7.pageviews} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>összes nézet</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--accent-gold)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Users size={14} />
              {last7.unique_visitors} heti látogató
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Napi átlag: ~{last7.daily_avg_views} oldalmegnyitás / nap
          </div>
        </div>

        {/* Card 3: Közösségi aktivitás */}
        <div className="glass-panel" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #ff70a6, #70d6ff)'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Közösségi Interakciók
            </span>
            <div style={{
              background: 'rgba(255, 112, 166, 0.12)',
              color: '#ff70a6',
              padding: '6px',
              borderRadius: '8px'
            }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', marginTop: '6px' }}>
            {today.events} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>mai akció</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.85rem' }}>
            <span style={{ color: '#ff70a6', fontWeight: 700 }}>
              {allTime.total_events} összes rögzített esemény
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Kvíz játékok, szavazatok és videó indítások
          </div>
        </div>

        {/* Card 4: Eszköz megoszlás */}
        <div className="glass-panel" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #06d6a0, var(--accent-cyan))'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Eszközök Megoszlása
            </span>
            <div style={{
              background: 'rgba(6, 214, 160, 0.12)',
              color: 'var(--accent-green)',
              padding: '6px',
              borderRadius: '8px'
            }}>
              <Monitor size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', marginTop: '6px' }}>
            {deviceStats.desktop_pct}% <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Asztali</span> / {deviceStats.mobile_pct}% <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Mobil</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--accent-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Monitor size={13} /> {deviceStats.desktop} db
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Smartphone size={13} /> {deviceStats.mobile} db
            </span>
            {deviceStats.tablet > 0 && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ color: 'var(--accent-gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Tablet size={13} /> {deviceStats.tablet} db
                </span>
              </>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Böngésző User-Agent alapján azonosítva
          </div>
        </div>
      </div>

      {/* MAIN INTERACTIVE TIMELINE CHART */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span>Napi Látogatottsági Trend ({days} nap)</span>
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Vidd a kurzort az oszlopok fölé a részletes napi adatok megtekintéséhez
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-cyan)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Oldalmegtekintés</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-gold)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Egyedi látogató</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ff70a6' }} />
              <span style={{ color: 'var(--text-muted)' }}>Interakció</span>
            </div>
          </div>
        </div>

        {/* CSS/SVG Responsive Chart */}
        <div style={{
          width: '100%',
          height: '220px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: days === 30 ? '3px' : days === 14 ? '8px' : '16px',
          padding: '10px 5px 25px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative'
        }}>
          {chartData.map((d, idx) => {
            const viewHeightPct = Math.max(4, Math.round((d.pageviews / maxViews) * 100));
            const uniqueHeightPct = Math.max(3, Math.round((d.unique_visitors / maxViews) * 100));
            const isHovered = hoveredDay === d;
            const isToday = idx === chartData.length - 1;

            return (
              <div
                key={d.date}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: '2px',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                {/* Bar: Pageviews */}
                <div
                  style={{
                    width: '50%',
                    height: `${viewHeightPct}%`,
                    background: isToday 
                      ? 'linear-gradient(180deg, #00f0ff, #0077b6)' 
                      : isHovered 
                        ? 'linear-gradient(180deg, #38bdf8, #0284c7)' 
                        : 'rgba(0, 240, 255, 0.45)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isHovered ? '0 0 10px rgba(0, 240, 255, 0.6)' : 'none',
                    minHeight: d.pageviews > 0 ? '6px' : '2px'
                  }}
                />

                {/* Bar: Unique Visitors */}
                <div
                  style={{
                    width: '35%',
                    height: `${uniqueHeightPct}%`,
                    background: isToday 
                      ? 'linear-gradient(180deg, var(--accent-gold), #b58300)' 
                      : isHovered 
                        ? 'linear-gradient(180deg, #fbbf24, #d97706)' 
                        : 'rgba(255, 183, 3, 0.45)',
                    borderRadius: '2px 2px 0 0',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isHovered ? '0 0 10px rgba(255, 183, 3, 0.6)' : 'none',
                    minHeight: d.unique_visitors > 0 ? '5px' : '2px'
                  }}
                />

                {/* X-axis date labels */}
                {(days <= 14 || idx % 3 === 0 || idx === chartData.length - 1) && (
                  <span style={{
                    position: 'absolute',
                    bottom: '-22px',
                    fontSize: '0.68rem',
                    color: isToday ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontWeight: isToday ? 800 : 500,
                    whiteSpace: 'nowrap'
                  }}>
                    {d.display_date}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Hover details badge */}
        <div style={{
          marginTop: '1.25rem',
          padding: '0.85rem 1.25rem',
          background: 'rgba(0, 0, 0, 0.35)',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.8rem'
        }}>
          {hoveredDay ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>
                📅 {hoveredDay.date} ({hoveredDay.day_name}):
              </span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.9rem' }}>
                👁️ {hoveredDay.pageviews} oldalletöltés
              </span>
              <span style={{ color: 'var(--accent-gold)', fontWeight: 700, fontSize: '0.9rem' }}>
                👥 {hoveredDay.unique_visitors} egyedi látogató
              </span>
              <span style={{ color: '#ff70a6', fontWeight: 700, fontSize: '0.9rem' }}>
                ⚡ {hoveredDay.events} interakció
              </span>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={15} />
              <span>Mai állapot: <b>{today.pageviews} oldalletöltés</b> és <b>{today.unique_visitors} látogató</b> rögzítve ma. Vidd a kurzort egy másik nap fölé a visszatekintéshez.</span>
            </div>
          )}

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Összesített oldalletöltés (mindent egybevetve): <b style={{ color: '#fff' }}>{allTime.pageviews}</b>
          </div>
        </div>
      </div>

      {/* TWO COLUMNS: REFERRERS & EVENTS BREAKDOWN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left Card: Referrers / Forgalmi források */}
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span>Honnan érkeznek a látogatók?</span>
          </h3>

          {topReferrers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '1rem 0' }}>
              Még nem érkezett külső forgalom. A közvetlen megnyitások a Közvetlen (Direct) kategóriába kerülnek.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {topReferrers.map((ref) => (
                <div key={ref.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{ref.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      <b style={{ color: 'var(--accent-cyan)' }}>{ref.count}</b> látogatás ({ref.percentage}%)
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${ref.percentage}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--accent-cyan), #3a86ff)',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Card: Interakciók & BudiCheck események */}
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} style={{ color: 'var(--accent-gold)' }} />
            <span>Közösségi funkciók használata ({days} nap)</span>
          </h3>

          {topEvents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '1rem 0' }}>
              Még nem történt közösségi esemény a kiválasztott időszakban.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {topEvents.map((ev) => (
                <div
                  key={ev.type}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.9rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getEventIcon(ev.type)}
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
                      {ev.label}
                    </span>
                  </div>
                  <span style={{
                    background: 'rgba(255, 183, 3, 0.15)',
                    color: 'var(--accent-gold)',
                    border: '1px solid rgba(255, 183, 3, 0.3)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    fontWeight: 800
                  }}>
                    {ev.count} alkalom
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* REAL-TIME LIVE ACTIVITY STREAM */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: 'var(--accent-green)' }} />
              <span>Valós Idejű Eseménynapló (Utolsó 30 aktivitás)</span>
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Élő látogatói interakciók és oldalmegtekintések időrendi sorrendben
            </p>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Frissítve: {new Date().toLocaleTimeString('hu-HU')}
          </span>
        </div>

        {recentActivity.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Még nincs rögzített élő aktivitás. Amint a felhasználók böngészik az oldalt vagy kvízeznek, itt fognak megjelenni!
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxHeight: '340px',
            overflowY: 'auto',
            paddingRight: '6px'
          }}>
            {recentActivity.map((act) => (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.85rem',
                  background: 'rgba(0, 0, 0, 0.35)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: '0.82rem',
                  gap: '0.8rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    padding: '5px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {getEventIcon(act.type)}
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700, color: '#fff', marginRight: '6px' }}>{act.title}</span>
                    {act.details && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        ({act.details})
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {act.device === 'mobile' ? <Smartphone size={11} /> : <Monitor size={11} />}
                    {act.device === 'mobile' ? 'Mobil' : 'Desktop'}
                  </span>

                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {act.time_formatted || act.timestamp?.split('T')?.[1]?.substring(0, 8) || ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER & RESET CONTROLS */}
      <div className="glass-panel" style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        borderColor: 'rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={18} style={{ color: 'var(--accent-green)' }} />
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span style={{ color: '#fff', fontWeight: 700 }}>GDPR & Adatvédelem:</span> Minden látogató anonim hash alapján kerül azonosításra napi szinten. Nem kerülnek tárolásra személyes azonosítók vagy IP-címek.
          </div>
        </div>

        <button
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={resetting}
          style={{
            borderColor: 'rgba(255, 77, 109, 0.4)',
            color: 'var(--accent-red)',
            fontSize: '0.8rem',
            padding: '0.45rem 0.85rem'
          }}
        >
          <Trash2 size={13} />
          <span>{resetting ? 'Törlés...' : 'Statisztikák nullázása'}</span>
        </button>
      </div>
    </div>
  );
}
