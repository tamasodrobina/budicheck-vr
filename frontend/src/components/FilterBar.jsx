import React from 'react';
import { Search, LayoutGrid, List, Trophy, Users, Sparkles } from 'lucide-react';

export default function FilterBar({
  search,
  setSearch,
  preset,
  setPreset,
  minRating,
  setMinRating,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  totalItems
}) {
  const handlePresetClick = (p, minR) => {
    setPreset(p);
    setMinRating(minR);
  };

  const isTierList = viewMode === 'tierlist' || viewMode === 'community_tierlist';
  const isCommunityTierList = viewMode === 'community_tierlist';

  // 1. COMMUNITY TIER LIST MODE: No search, no card/table view buttons, just clear title and switch back to Jani's tier list!
  if (isCommunityTierList) {
    return (
      <div className="glass-panel filter-bar" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
        <div className="filter-bar-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(157, 78, 221, 0.2)',
            border: '1px solid rgba(157, 78, 221, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#d8b4fe',
            flexShrink: 0
          }}>
            <Users size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#fff' }}>
              Közösségi BudiCheck Rangsor (Tier List)
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              A nézők és a közösség szavazatai alapján rangsorolva
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setViewMode('tierlist')}
          style={{
            background: 'linear-gradient(135deg, #ffb703 0%, #ff9800 100%)',
            color: '#000',
            fontWeight: 800,
            boxShadow: '0 4px 15px rgba(255, 183, 3, 0.35)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          title="Visszaváltás Jani hivatalos értékelései szerinti rangsorra"
        >
          <Sparkles size={16} />
          <span>👑 Vissza Jani Rangsorára</span>
        </button>
      </div>
    );
  }

  // 2. JANI TIER LIST MODE: No search input per user request, but has button to switch to Community Tier List + view mode switchers!
  if (isTierList) {
    return (
      <div className="glass-panel filter-bar" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
        <div className="filter-bar-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(0, 242, 254, 0.15)',
            border: '1px solid rgba(0, 242, 254, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            flexShrink: 0
          }}>
            <Trophy size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#fff' }}>
              TheVR Jani BudiCheck Rangsor (Tier List)
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Jani elhangzott 0-10 pontszámai alapján rendszerezve ({totalItems} budi)
            </p>
          </div>
        </div>

        <div className="filter-bar-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Switch to Community Tier List Button */}
          <button
            className="btn btn-secondary"
            onClick={() => setViewMode('community_tierlist')}
            style={{
              background: 'rgba(157, 78, 221, 0.18)',
              borderColor: 'rgba(157, 78, 221, 0.45)',
              color: '#d8b4fe',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Átváltás a közösségi szavazatok alapján felépülő Tier Listre"
          >
            <Users size={16} />
            <span>👥 Váltás Közösségi Tier Listre</span>
          </button>

          {/* View mode switcher: Tier List / Grid / Table */}
          <div className="filter-bar-view-switch" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px', gap: '3px' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '0.35rem 0.75rem', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', fontWeight: 700 }}
              onClick={() => setViewMode('tierlist')}
              title="Tier List nézet"
            >
              <Trophy size={15} />
              <span>Tier List</span>
            </button>
            <button
              className="btn btn-icon btn-secondary"
              style={{ padding: '0.35rem 0.6rem', border: 'none' }}
              onClick={() => setViewMode('grid')}
              title="Kártya nézet (itt elérhető a kereső és szűrők)"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className="btn btn-icon btn-secondary"
              style={{ padding: '0.35rem 0.6rem', border: 'none' }}
              onClick={() => setViewMode('table')}
              title="Táblázat nézet (itt elérhető a kereső és szűrők)"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. CARD (GRID) & TABLE (LISTA) MODE: Full search bar, score presets, sorting and view switchers are available!
  return (
    <div className="glass-panel filter-bar">
      {/* Search Input - available ONLY in Grid & Table view per request */}
      <div className="search-input-wrapper">
        <Search size={18} />
        <input
          type="text"
          className="search-input"
          placeholder="Keresés játék (pl. EPOS 11, Silent Hill), videócím vagy idézet..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Preset Chips */}
      <div className="score-presets">
        <button
          className={`preset-chip ${preset === 'all' ? 'active' : ''}`}
          onClick={() => handlePresetClick('all', 0)}
        >
          Összes ({totalItems})
        </button>
        <button
          className={`preset-chip ${preset === 'masterpiece' ? 'active' : ''}`}
          onClick={() => handlePresetClick('masterpiece', 9.0)}
        >
          🏆 9 - 10 Mestermű
        </button>
        <button
          className={`preset-chip ${preset === 'good' ? 'active' : ''}`}
          onClick={() => handlePresetClick('good', 7.0)}
        >
          👍 7 - 8.9 Jó
        </button>
        <button
          className={`preset-chip ${preset === 'average' ? 'active' : ''}`}
          onClick={() => handlePresetClick('average', 4.0)}
        >
          😐 4 - 6.9 Átlagos
        </button>
        <button
          className={`preset-chip ${preset === 'bad' ? 'active' : ''}`}
          onClick={() => handlePresetClick('bad', 0.1)}
        >
          🤮 0 - 3.9 Katasztrófa
        </button>
      </div>

      {/* Controls Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
        {/* Sort selector with dark options */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="form-input"
          style={{
            width: 'auto',
            padding: '0.5rem 0.8rem',
            fontSize: '0.88rem',
            backgroundColor: '#121726',
            color: '#f1f5f9',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            cursor: 'pointer'
          }}
        >
          <option value="rating_desc" style={{ backgroundColor: '#121726', color: '#f1f5f9' }}>⭐ Legmagasabb (Jani)</option>
          <option value="rating_asc" style={{ backgroundColor: '#121726', color: '#f1f5f9' }}>💩 Legalacsonyabb (Jani)</option>
          <option value="community_desc" style={{ backgroundColor: '#121726', color: '#f1f5f9' }}>👥 Legjobb Közösségi Értékelés</option>
          <option value="newest" style={{ backgroundColor: '#121726', color: '#f1f5f9' }}>🕒 Legújabb bejegyzés</option>
          <option value="oldest" style={{ backgroundColor: '#121726', color: '#f1f5f9' }}>⌛ Legrégebbi bejegyzés</option>
        </select>

        {/* View switch buttons */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px', gap: '3px' }}>
          <button
            className={`btn ${viewMode === 'tierlist' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.75rem', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', fontWeight: 600 }}
            onClick={() => setViewMode('tierlist')}
            title="Tier List nézet"
          >
            <Trophy size={15} />
            <span>Tier List</span>
          </button>
          <button
            className={`btn btn-icon ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.6rem', border: 'none' }}
            onClick={() => setViewMode('grid')}
            title="Kártya nézet"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={`btn btn-icon ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.6rem', border: 'none' }}
            onClick={() => setViewMode('table')}
            title="Táblázat nézet"
          >
            <List size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
