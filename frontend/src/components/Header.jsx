import React from 'react';
import { RefreshCw, Shield, Trophy } from 'lucide-react';

export default function Header({ onRefresh, onGoToAdmin, isAdminView, hasAdminSession }) {
  return (
    <header className="header">
      <div className="container header-content">
        <div 
          className="brand" 
          onClick={() => { if (isAdminView) onGoToAdmin(false); }} 
          style={{ cursor: isAdminView ? 'pointer' : 'default' }}
          title={isAdminView ? 'Vissza a rangsorhoz' : undefined}
        >
          <div className="brand-icon">🚽</div>
          <div>
            <h1 className="brand-title">
              BudiCheck <span style={{ color: 'var(--accent-cyan)' }}>VR</span>
            </h1>
            <p className="brand-tagline">TheVR Jani BudiCheck Rangsor & Archívum</p>
          </div>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={onRefresh} 
            title="Adatok Frissítése"
          >
            <RefreshCw size={17} />
          </button>

          {/* Admin toggle - only visible when authenticated */}
          {hasAdminSession && (
            isAdminView ? (
              <button 
                className="btn btn-primary" 
                onClick={() => onGoToAdmin(false)} 
                style={{ fontSize: '0.85rem', padding: '0.45rem 0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Vissza a rangsorhoz"
              >
                <Trophy size={15} />
                <span>Vissza a Rangsorhoz</span>
              </button>
            ) : (
              <button 
                className="btn btn-secondary" 
                onClick={() => onGoToAdmin(true)} 
                style={{ 
                  fontSize: '0.85rem', 
                  padding: '0.45rem 0.95rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  background: 'rgba(0, 242, 254, 0.12)',
                  borderColor: 'rgba(0, 242, 254, 0.4)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 600
                }}
                title="Váltás az adminisztrációs felületre"
              >
                <Shield size={15} />
                <span>Admin Felület</span>
                {Boolean(status?.open_reports_count) && (
                  <span style={{
                    background: 'var(--accent-red)',
                    color: '#fff',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    marginLeft: '2px'
                  }}>
                    {status.open_reports_count}
                  </span>
                )}
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
