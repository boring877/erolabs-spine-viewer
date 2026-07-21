import { useState } from "react";

// Right panel: animation controls + playback + settings.
//
// Receives the Spine player instance from the parent (via onReady on
// SpineCanvas) and uses its API:
//   player.animationState.setAnimation(0, name, true)  — switch animation
//   player.animationState.timeScale                     — playback speed
//   player.pause() / player.play()                      — pause/resume
export default function ControlsPanel({
  player,
  animations,
  currentAnim,
  onSwitchAnim,
  settings,
  onUpdateSettings,
  charInfo,
}) {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(settings.playbackSpeed ?? 1.0);

  function handlePause() {
    if (!player) return;
    if (paused) {
      player.play();
      setPaused(false);
    } else {
      player.pause();
      setPaused(true);
    }
  }

  function handleSpeed(val) {
    setSpeed(val);
    if (player?.animationState) {
      player.animationState.timeScale = val;
    }
  }

  return (
    <aside className="controls-panel">
      {/* ─── Character Info ─── */}
      {charInfo && (
        <div className="ctrl-section">
          <div className="ctrl-info">
            <div className="ctrl-info-id">{charInfo.id}</div>
            <div className="ctrl-info-meta">
              {charInfo.spineVersion && <span>Spine {charInfo.spineVersion}</span>}
              <span className="ctrl-info-dot">·</span>
              <span>{animations.length} anims</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Animations ─── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Animations</div>
        {animations.length === 0 ? (
          <div className="ctrl-empty">No animations</div>
        ) : (
          <div className="ctrl-anim-list">
            {animations.map((name) => (
              <button
                key={name}
                className={`ctrl-anim-btn ${currentAnim === name ? "active" : ""}`}
                onClick={() => onSwitchAnim(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Playback ─── */}
      {animations.length > 0 && (
        <div className="ctrl-section">
          <div className="ctrl-section-title">Playback</div>
          <div className="ctrl-playback">
            <button className="ctrl-play-btn" onClick={handlePause} disabled={!player}>
              {paused ? "▶ Play" : "⏸ Pause"}
            </button>
          </div>
          <div className="ctrl-speed">
            <label>Speed</label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={speed}
              onChange={(e) => handleSpeed(+e.target.value)}
            />
            <span className="ctrl-speed-value">{speed.toFixed(1)}×</span>
          </div>
        </div>
      )}

      {/* ─── Settings ─── */}
      <div className="ctrl-section">
        <div className="ctrl-section-title">Settings</div>
        <div className="ctrl-setting">
          <label>Background</label>
          <input
            type="color"
            value={settings.backgroundColor}
            onChange={(e) => onUpdateSettings({ backgroundColor: e.target.value })}
          />
          <span className="ctrl-setting-value">{settings.backgroundColor}</span>
        </div>
        <div className="ctrl-setting">
          <label>Default zoom</label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={settings.defaultZoom}
            onChange={(e) => onUpdateSettings({ defaultZoom: +e.target.value })}
          />
          <span className="ctrl-setting-value">{Math.round(settings.defaultZoom * 100)}%</span>
        </div>
        <div className="ctrl-setting">
          <label>Default speed</label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={settings.playbackSpeed ?? 1.0}
            onChange={(e) => onUpdateSettings({ playbackSpeed: +e.target.value })}
          />
          <span className="ctrl-setting-value">{Math.round((settings.playbackSpeed ?? 1.0) * 100)}%</span>
        </div>
        <div className="ctrl-setting ctrl-setting-row">
          <label>Thumbnails</label>
          <input
            type="checkbox"
            checked={settings.showThumbnails ?? true}
            onChange={(e) => onUpdateSettings({ showThumbnails: e.target.checked })}
          />
        </div>
      </div>

      {/* ─── Keyboard hints ─── */}
      <div className="ctrl-hints">
        <div className="ctrl-hint"><kbd>↑</kbd><kbd>↓</kbd> Navigate</div>
        <div className="ctrl-hint"><kbd>←</kbd><kbd>→</kbd> Switch anim</div>
        <div className="ctrl-hint"><kbd>Space</kbd> Pause</div>
      </div>
    </aside>
  );
}
