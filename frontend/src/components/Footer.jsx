import React from 'react';
import { Shield, Youtube, ExternalLink, Heart, Bug, Sparkles, Database, Info } from 'lucide-react';

export default function Footer({ status, checksCount, onOpenGeneralReport }) {
  const totalVideos = status?.total_channel_videos || 226;
  const processedVideos = status?.scanned_videos_count ?? status?.processed_count ?? 225;
  const matchesCount = checksCount || status?.matches_found || 0;
  const percentProcessed = Math.min(100, Math.round((processedVideos / (totalVideos > 1 ? totalVideos - 1 : totalVideos)) * 100));

  return (
    <footer className="site-footer" style={{
      marginTop: '5rem',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      background: 'rgba(7, 9, 15, 0.95)',
      backdropFilter: 'blur(16px)',
      position: 'relative',
      zIndex: 10
    }}>
      <div className="container" style={{ padding: '3.5rem 1.5rem 2.5rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2.5rem',
          marginBottom: '2.5rem'
        }}>
          {/* 1. BRAND & MISSION */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem'
              }}>
                🚽
              </div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                margin: 0,
                background: 'linear-gradient(90deg, #ffffff, #a5f3fc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                TheVR Jani BudiCheck
              </h3>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
              A WeAreTheVR videókban és végigjátszásokban elhangzott ikonikus vécé-értékelések közösségi rangsora, archívuma és kvízjátéka.
            </p>

            <div style={{ marginTop: '1.2rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onOpenGeneralReport}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#ff758f',
                  borderColor: 'rgba(255, 117, 143, 0.35)',
                  background: 'rgba(255, 117, 143, 0.08)'
                }}
                title="Weboldal hiba, mobilos nézet vagy észrevétel bejelentése"
              >
                <Bug size={14} />
                <span>Hibabejelentés / Észrevétel</span>
              </button>

              <a
                href="https://www.youtube.com/@wearethevr"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#ff4d4d',
                  borderColor: 'rgba(255, 77, 77, 0.35)'
                }}
              >
                <Youtube size={14} />
                <span>TheVR YouTube</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* 2. FORRÁS & BŐVÜLŐ ARCHÍVUM */}
          <div>
            <h4 style={{
              fontSize: '0.92rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--accent-cyan)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Database size={16} />
              <span>Forrás & Bővülő Archívum</span>
            </h4>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '10px',
              padding: '1rem',
              fontSize: '0.85rem'
            }}>
              <div style={{ marginBottom: '0.75rem', color: '#f1f5f9' }}>
                <strong style={{ color: 'var(--text-muted)' }}>Alapul szolgáló forrás:</strong>{' '}
                <a
                  href="https://youtube.com/playlist?list=PL-0aMuV87MLWOwH9PLKO1EBYStLmIKScV"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>TheVR – Indie Horror Lejátszási Lista</span>
                  <ExternalLink size={11} />
                </a>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                <span>Lejátszási lista összesen:</span>
                <strong style={{ color: '#fff' }}>{totalVideos} videó</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                <span>Eddig átnézve / feldolgozva:</span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{processedVideos} videó (100% elérhető)</strong>
              </div>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginBottom: '0.6rem', fontStyle: 'italic', lineHeight: '1.4' }}>
                * Mind a 225 nyilvánosan elérhető videó teljesen feldolgozva (1 db videó privát/törölt a YouTube listában).
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
                paddingTop: '0.4rem',
                paddingBottom: '0.65rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>Talált BudiCheck-ek:</span>
                <span style={{
                  background: 'rgba(255, 183, 3, 0.15)',
                  color: 'var(--accent-gold)',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 183, 3, 0.3)'
                }}>
                  👑 {matchesCount} db budi
                </span>
              </div>

              <div style={{
                background: 'rgba(0, 242, 254, 0.05)',
                border: '1px solid rgba(0, 242, 254, 0.16)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.8rem',
                lineHeight: '1.55',
                color: '#cbd5e1'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                  marginBottom: '4px'
                }}>
                  <Sparkles size={14} />
                  <span>Folyamatosan töltjük fel!</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Nem feltétlenül ez az összes budi a videókból. A több száz órányi felvétel átnézése és a vágások elkészítése rendkívül időigényes, de az archívum folyamatosan bővül az újabb részekkel.
                </p>
              </div>
            </div>
          </div>

          {/* 3. JOGI NYILATKOZAT / DISCLAIMER */}
          <div>
            <h4 style={{
              fontSize: '0.92rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#ffb703',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Shield size={16} />
              <span>Jogi Nyilatkozat (Disclaimer)</span>
            </h4>

            <div style={{
              fontSize: '0.79rem',
              color: 'var(--text-muted)',
              lineHeight: '1.55',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '10px',
              padding: '0.9rem'
            }}>
              <p style={{ margin: '0 0 0.6rem 0' }}>
                <strong style={{ color: '#fff' }}>Nem hivatalos rajongói oldal:</strong> Ez a projekt egy független, közösségi rajongói kezdeményezés. Semmilyen hivatalos, üzleti, szponzori vagy jogi kapcsolatban nem áll a <strong>TheVR / WeAreTheVR csatornákkal, alkotóival (Komzsik János, Fábián István)</strong>, illetve a mögöttük álló <strong>WE ARE MEDIA TECH Bt.-vel</strong>.
              </p>
              <p style={{ margin: 0 }}>
                A «TheVR» és «WeAreTheVR» nevek, védjegyek és hang/képi anyagok a WE ARE MEDIA TECH Bt., illetve jogosult tulajdonosaik szellemi tulajdonát képezik. Az anyagok idézése kizárólag archívumi és rajongói céllal (méltányos használat / Fair Use) történik, közvetlenül a hivatalos YouTube videókat és nézettséget támogatva.
              </p>
            </div>
          </div>
        </div>

        {/* BOTTOM COPYRIGHT BAR */}
        <div style={{
          paddingTop: '1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.78rem',
          color: 'var(--text-dim)'
        }}>
          <div>
            © {new Date().getFullYear()} TheVR Jani BudiCheck Archívum • Független rajongói közösségi oldal
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>Készült szeretettel a TheVR közösség számára</span>
            <Heart size={13} style={{ color: '#ff4d6d', fill: '#ff4d6d' }} />
          </div>
        </div>
      </div>
    </footer>
  );
}
