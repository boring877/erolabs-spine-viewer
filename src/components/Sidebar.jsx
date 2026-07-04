import { useMemo, useState } from "react";

// Modern sidebar: game picker, search, grouped animation list with thumbnails.
export default function Sidebar({
  games,
  selectedGameId,
  onSelectGame,
  animations,
  selectedId,
  onSelect,
  thumbnailBaseUrl,
  showThumbnails,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return animations;
    return animations.filter((a) => a.id.toLowerCase().includes(q));
  }, [animations, query]);

  const groups = useMemo(() => {
    const g = { portrait: [], cg: [], other: [] };
    for (const a of filtered) (g[a.kind] || g.other).push(a);
    return g;
  }, [filtered]);

  const labelFor = { portrait: "Portraits", cg: "CGs", other: "Other" };
  const currentGame = games.find((g) => g.id === selectedGameId);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <select
          className="game-select"
          value={selectedGameId || ""}
          onChange={(e) => onSelectGame(e.target.value)}
        >
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.found ? ` (${g.animations.length})` : " (no data)"}
            </option>
          ))}
        </select>
      </div>
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="sidebar-count">
        {currentGame && currentGame.found
          ? `${filtered.length} / ${currentGame.animations.length}`
          : "no data"}
      </div>
      <div className="sidebar-list">
        {Object.entries(groups).map(([kind, items]) =>
          items.length === 0 ? null : (
            <div key={kind} className="sidebar-group">
              <div className="sidebar-group-title">{labelFor[kind]}</div>
              {items.map((a) => (
                <button
                  key={a.id}
                  className={`anim-item ${selectedId === a.id ? "active" : ""}`}
                  onClick={() => onSelect(a.id)}
                  title={a.id}
                >
                  {showThumbnails && a.thumbnail && thumbnailBaseUrl ? (
                    <img
                      className="anim-thumb"
                      src={`${thumbnailBaseUrl}/${a.thumbnail}`}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="anim-thumb-placeholder" />
                  )}
                  <span className="anim-label">{a.id}</span>
                </button>
              ))}
            </div>
          )
        )}
        {filtered.length === 0 && (
          <div className="sidebar-empty">
            {currentGame && !currentGame.found
              ? "No data for this game."
              : "No matches."}
          </div>
        )}
      </div>
    </aside>
  );
}
