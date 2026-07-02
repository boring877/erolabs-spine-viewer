import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar.jsx";
import SpineCanvas from "./components/SpineCanvas.jsx";

export default function App() {
  const [config, setConfig] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    invoke("get_app_config")
      .then((cfg) => {
        setConfig(cfg);
        // Default to the first portrait (or first animation) on launch.
        if (cfg.found && cfg.animations.length > 0) {
          const firstPortrait = cfg.animations.find((a) => a.kind === "portrait");
          setSelectedId((firstPortrait || cfg.animations[0]).id);
        }
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return <div className="fatal-error">Failed to start: {error}</div>;
  }
  if (!config) {
    return <div className="loading-screen">Loading...</div>;
  }
  if (!config.found) {
    return (
      <div className="fatal-error">
        <h2>No Spine data found</h2>
        <p>
          Expected animations at:
          <br />
          <code>{config.spineDir}</code>
        </p>
        <p>Run the extractor first (python extract_spine.py).</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        animations={config.animations}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <main className="viewer-main">
        {selectedId ? (
          <SpineCanvas id={selectedId} baseUrl={config.serverBaseUrl} />
        ) : (
          <div className="viewer-empty">Select an animation.</div>
        )}
      </main>
    </div>
  );
}
