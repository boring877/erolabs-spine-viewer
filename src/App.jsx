import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar.jsx";
import SpineCanvas from "./components/SpineCanvas.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import { useSettings } from "./useSettings.js";

export default function App() {
  const [config, setConfig] = useState(null);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, updateSettings] = useSettings();

  useEffect(() => {
    invoke("get_app_config")
      .then((cfg) => {
        setConfig(cfg);
        const firstFound = cfg.games.find((g) => g.found);
        if (firstFound) {
          setSelectedGameId(firstFound.id);
          const firstPortrait = firstFound.animations.find((a) => a.kind === "portrait");
          setSelectedId((firstPortrait || firstFound.animations[0]).id);
        }
      })
      .catch((e) => setError(String(e)));
  }, []);

  const selectedGame = useMemo(
    () => (config ? config.games.find((g) => g.id === selectedGameId) : null),
    [config, selectedGameId]
  );

  function handleSelectGame(id) {
    setSelectedGameId(id);
    const game = config.games.find((g) => g.id === id);
    if (game && game.animations.length > 0) {
      const firstPortrait = game.animations.find((a) => a.kind === "portrait");
      setSelectedId((firstPortrait || game.animations[0]).id);
    } else {
      setSelectedId(null);
    }
  }

  if (error) return <div className="fatal-error">Failed to start: {error}</div>;
  if (!config) return <div className="loading-screen">Loading…</div>;

  const anyFound = config.games.some((g) => g.found);
  if (!anyFound) {
    const dirs = config.games.map((g) => g.spineDir).join("\n");
    return (
      <div className="fatal-error">
        <h2>No Spine data found</h2>
        <pre>{dirs}</pre>
        <p>Run the extractors first (python extract_spine.py).</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-title">
          <span className="topbar-logo">◆</span> Erolabs Spine Viewer
        </div>
        <button className="topbar-btn" onClick={() => setSettingsOpen(true)}>
          ⚙ Settings
        </button>
      </header>
      <div className="app-body">
        <Sidebar
          games={config.games}
          selectedGameId={selectedGameId}
          onSelectGame={handleSelectGame}
          animations={selectedGame ? selectedGame.animations : []}
          selectedId={selectedId}
          onSelect={setSelectedId}
          thumbnailBaseUrl={selectedGame ? selectedGame.thumbnailBaseUrl : ""}
          showThumbnails={settings.showThumbnails}
        />
        <main className="viewer-main">
          {selectedGame && selectedId ? (
            <SpineCanvas
              id={selectedId}
              baseUrl={selectedGame.serverBaseUrl}
              backgroundColor={settings.backgroundColor}
              zoom={settings.defaultZoom}
              spineVersion={selectedGame.spineVersion}
            />
          ) : (
            <div className="viewer-empty">
              {selectedGame && !selectedGame.found
                ? `${selectedGame.name}: data not found`
                : "Select an animation."}
            </div>
          )}
        </main>
      </div>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSettings}
      />
    </div>
  );
}
