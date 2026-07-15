// Loads the official Spine web player from jsdelivr, keyed by major version.
// Different games use different Spine skeleton formats:
//   - Zone Nova / SIN Phantom: Spine 4.1
//   - Star Lust: Spine 4.0
// Loading the wrong major.minor player fails to parse the skeleton binary,
// so we keep a separate cached load per version line.

const PLAYER_VERSIONS = {
  "4.1": "4.1.52",
  "4.0": "4.0.9",
};

const loadCache = {}; // versionKey -> Promise

export function loadSpinePlayer(versionKey = "4.1") {
  const v = PLAYER_VERSIONS[versionKey] ? versionKey : "4.1";
  const ver = PLAYER_VERSIONS[v];

  if (window.__spinePlayers && window.__spinePlayers[v]) {
    return Promise.resolve(window.__spinePlayers[v]);
  }
  if (loadCache[v]) return loadCache[v];

  loadCache[v] = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `https://cdn.jsdelivr.net/npm/@esotericsoftware/spine-player@${ver}/dist/spine-player.css`;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = `https://cdn.jsdelivr.net/npm/@esotericsoftware/spine-player@${ver}/dist/iife/spine-player.js`;
    script.onload = () => {
      if (window.spine && window.spine.SpinePlayer) {
        if (!window.__spinePlayers) window.__spinePlayers = {};
        window.__spinePlayers[v] = window.spine;
        resolve(window.spine);
      } else {
        delete loadCache[v]; // allow retry
        reject(new Error("Spine player loaded but global not found"));
      }
    };
    script.onerror = () => {
      delete loadCache[v]; // allow retry on transient CDN failure
      reject(new Error("Failed to load Spine player from CDN"));
    };
    document.head.appendChild(script);
  });
  return loadCache[v];
}
