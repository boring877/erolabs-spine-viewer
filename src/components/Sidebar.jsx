import { useMemo, useState } from "react";

// Scrollable list of animations, grouped by type, with a search filter.
export default function Sidebar({ animations, selectedId, onSelect }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return animations;
    return animations.filter((a) => a.id.toLowerCase().includes(q));
  }, [animations, query]);

  // Group by kind while preserving sort order.
  const groups = useMemo(() => {
    const g = { portrait: [], cg: [], other: [] };
    for (const a of filtered) {
      (g[a.kind] || g.other).push(a);
    }
    return g;
  }, [filtered]);

  const labelFor = { portrait: "Portraits", cg: "CGs", other: "Other" };

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search character ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="sidebar-count">{filtered.length} animations</div>
      </div>
      <div className="sidebar-list">
        {Object.entries(groups).map(([kind, items]) =>
          items.length === 0 ? null : (
            <div key={kind} className="sidebar-group">
              <div className="sidebar-group-title">{labelFor[kind]}</div>
              {items.map((a) => (
                <button
                  key={a.id}
                  className={`sidebar-item ${selectedId === a.id ? "active" : ""}`}
                  onClick={() => onSelect(a.id)}
                >
                  {a.id}
                </button>
              ))}
            </div>
          )
        )}
        {filtered.length === 0 && (
          <div className="sidebar-empty">No matches.</div>
        )}
      </div>
    </aside>
  );
}
