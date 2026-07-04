// Slide-out settings panel for background color, default zoom, thumbnails.
export default function SettingsPanel({ open, onClose, settings, onUpdate }) {
  if (!open) return null;
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>
        <div className="settings-body">
          <label className="settings-row">
            <span>Background</span>
            <input
              type="color"
              value={settings.backgroundColor}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            />
          </label>
          <label className="settings-row">
            <span>Default zoom</span>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={settings.defaultZoom}
              onChange={(e) => onUpdate({ defaultZoom: +e.target.value })}
            />
            <span className="settings-value">{Math.round(settings.defaultZoom * 100)}%</span>
          </label>
          <label className="settings-row">
            <span>Sidebar thumbnails</span>
            <input
              type="checkbox"
              checked={settings.showThumbnails}
              onChange={(e) => onUpdate({ showThumbnails: e.target.checked })}
            />
          </label>
        </div>
        <div className="settings-footer">
          Settings save automatically.
        </div>
      </div>
    </div>
  );
}
