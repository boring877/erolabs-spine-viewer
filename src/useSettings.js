import { useEffect, useState } from "react";

// User settings persisted to localStorage (survives app restarts).
// Defaults chosen for the best out-of-box experience.
const STORAGE_KEY = "erolabs-spine-viewer-settings";
const DEFAULTS = {
  backgroundColor: "#1a1a2e",
  defaultZoom: 1.0,
  showThumbnails: true,
  sidebarWidth: 260,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    /* ignore corrupt storage */
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    /* ignore quota errors */
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  function update(patch) {
    setSettings((s) => ({ ...s, ...patch }));
  }

  return [settings, update];
}
