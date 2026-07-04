// Loads the official Spine 4.1 web player from jsdelivr (same CDN/version that
// works in serve_spine.py) and resolves once the global `spine` is available.
// Loaded once per app session; cached by the browser afterwards.

let loadPromise = null;

export function loadSpinePlayer() {
  if (window.spine && window.spine.SpinePlayer) {
    return Promise.resolve(window.spine);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // CSS first (non-blocking).
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href =
      "https://cdn.jsdelivr.net/npm/@esotericsoftware/spine-player@4.1.52/dist/spine-player.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@esotericsoftware/spine-player@4.1.52/dist/iife/spine-player.js";
    script.onload = () => {
      if (window.spine && window.spine.SpinePlayer) resolve(window.spine);
      else {
        loadPromise = null; // allow retry
        reject(new Error("Spine player loaded but global not found"));
      }
    };
    script.onerror = () => {
      loadPromise = null; // allow retry on transient CDN failure
      reject(new Error("Failed to load Spine player from CDN"));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}
