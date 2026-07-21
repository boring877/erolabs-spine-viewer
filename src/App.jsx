import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar.jsx";
import SpineCanvas from "./components/SpineCanvas.jsx";
import ControlsPanel from "./components/ControlsPanel.jsx";
import { useSettings } from "./useSettings.js";

export default function App() {
  const [config, setConfig] = useState(null);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [settings, updateSettings] = useSettings();

  // Player state — populated by SpineCanvas when the player loads.
  const [player, setPlayer] = useState(null);
  const [animations, setAnimations] = useState([]);
  const [currentAnim, setCurrentAnim] = useState(null);

  // Load app config on mount.
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

  const currentAnimations = selectedGame ? selectedGame.animations : [];
  const currentIndex = currentAnimations.findIndex((a) => a.id === selectedId);

  // Add a custom folder as a new "game" entry.
  function handleAddCustomGame(gameInfo) {
    setConfig((prev) => {
      if (!prev) return prev;
      // Remove any existing entry with the same id (re-opening a folder).
      const filtered = prev.games.filter((g) => g.id !== gameInfo.id);
      return { ...prev, games: [...filtered, gameInfo] };
    });
    // Switch to the newly added game.
    setSelectedGameId(gameInfo.id);
    const firstPortrait = gameInfo.animations.find((a) => a.kind === "portrait");
    setSelectedId((firstPortrait || gameInfo.animations[0])?.id);
  }

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

  // Called when SpineCanvas finishes loading the player.
  function handlePlayerReady(p, anims) {
    setPlayer(p);
    setAnimations(anims);
    setCurrentAnim(anims.length > 0 ? anims[0] : null);
    // Apply default playback speed.
    if (p?.animationState) {
      p.animationState.timeScale = settings.playbackSpeed ?? 1.0;
    }
  }

  // Switch animation by name.
  function handleSwitchAnim(name) {
    if (player?.animationState) {
      player.animationState.setAnimation(0, name, true);
    }
    setCurrentAnim(name);
  }

  // Keyboard shortcuts.
  useEffect(() => {
    function onKeyDown(e) {
      // Don't interfere with form inputs.
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "ArrowDown":
          if (currentIndex < currentAnimations.length - 1) {
            e.preventDefault();
            setSelectedId(currentAnimations[currentIndex + 1].id);
          }
          break;
        case "ArrowUp":
          if (currentIndex > 0) {
            e.preventDefault();
            setSelectedId(currentAnimations[currentIndex - 1].id);
          }
          break;
        case "ArrowLeft":
        case "ArrowRight": {
          if (animations.length > 1) {
            e.preventDefault();
            const idx = animations.indexOf(currentAnim);
            const next = e.key === "ArrowRight"
              ? Math.min(animations.length - 1, idx + 1)
              : Math.max(0, idx - 1);
            handleSwitchAnim(animations[next]);
          }
          break;
        }
        case " ":
          if (player) {
            e.preventDefault();
            if (player.paused) {
              player.play();
            } else {
              player.pause();
            }
          }
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, currentAnimations, animations, currentAnim, player]);

  // ─── Render ───

  if (error) return <div className="fatal-error">Failed to start: {error}</div>;
  if (!config) return <div className="loading-screen">Loading…</div>;

  const anyFound = config.games.some((g) => g.found);
  if (!anyFound) {
    return (
      <div className="fatal-error">
        <h2>No Spine data found</h2>
        <p>Click "Open Folder" to browse for spine files.</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* ─── Top bar ─── */}
      <header className="topbar">
        <div className="topbar-title">
          <span className="topbar-logo">◆</span> Erolabs Spine Viewer
        </div>
        <div className="topbar-hint">
          ↑↓ navigate · ←→ switch anim · Space pause
        </div>
      </header>

      {/* ─── 3-column body ─── */}
      <div className="app-body">
        {/* Left: character selection */}
        <Sidebar
          games={config.games}
          selectedGameId={selectedGameId}
          onSelectGame={handleSelectGame}
          animations={selectedGame ? selectedGame.animations : []}
          selectedId={selectedId}
          onSelect={setSelectedId}
          thumbnailBaseUrl={selectedGame ? selectedGame.thumbnailBaseUrl : ""}
          showThumbnails={settings.showThumbnails}
          onAddCustomGame={handleAddCustomGame}
        />

        {/* Center: Spine player */}
        <main className="viewer-main">
          {selectedGame && selectedId ? (
            <SpineCanvas
              key={`${selectedGameId}-${selectedId}`}
              id={selectedId}
              baseUrl={selectedGame.serverBaseUrl}
              backgroundColor={settings.backgroundColor}
              spineVersion={selectedGame.spineVersion}
              onReady={handlePlayerReady}
            />
          ) : (
            <div className="viewer-empty">
              {selectedGame && !selectedGame.found
                ? `${selectedGame.name}: data not found`
                : "Select a character."}
            </div>
          )}
        </main>

        {/* Right: animation controls + settings */}
        <ControlsPanel
          player={player}
          animations={animations}
          currentAnim={currentAnim}
          onSwitchAnim={handleSwitchAnim}
          settings={settings}
          onUpdateSettings={updateSettings}
          charInfo={{
            id: selectedId,
            spineVersion: selectedGame?.spineVersion,
          }}
        />
      </div>
    </div>
  );
}
