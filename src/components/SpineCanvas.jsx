import { useEffect, useRef, useState } from "react";
import { loadSpinePlayer } from "../spinePlayerLoader.js";

// Renders one Spine animation with zoom controls.
//
// IMPORTANT: the Spine 4.1 web player exposes NO public dispose() method, but
// every `new SpinePlayer(...)` acquires a WebGL context + starts a
// requestAnimationFrame loop. Browsers cap ~16 live WebGL contexts, so if we
// don't release them on character switch the viewer breaks after browsing a
// handful of characters. Cleanup therefore:
//   1. cancels the player's rAF loop (best-effort),
//   2. forces WebGL context loss via WEBGL_lose_context on the canvas,
//   3. clears the DOM.
export default function SpineCanvas({ id, baseUrl, backgroundColor, zoom, spineVersion = "4.1" }) {
  const mountRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [localZoom, setLocalZoom] = useState(zoom || 1);
  const localZoomRef = useRef(localZoom);

  useEffect(() => {
    localZoomRef.current = localZoom;
  }, [localZoom]);

  useEffect(() => {
    setLocalZoom(zoom || 1);
    localZoomRef.current = zoom || 1;
  }, [id, zoom]);

  function applyZoom(z) {
    const mount = mountRef.current;
    if (!mount) return;
    const canvas = mount.querySelector("canvas");
    if (canvas) {
      canvas.style.transform = `scale(${z})`;
      canvas.style.transformOrigin = "center center";
    }
  }

  // Re-apply zoom whenever it changes or the player becomes ready.
  useEffect(() => {
    applyZoom(localZoom);
  }, [localZoom, status]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    // Detect whether the skeleton is JSON or binary by fetching its first byte.
    // JSON skeletons start with '{'; binary skeletons start with a hash string.
    const skelUrl = `${baseUrl}/${id}/${id}.skel`;
    const atlasUrl = `${baseUrl}/${id}/${id}.atlas`;

    fetch(skelUrl)
      .then((r) => r.text())
      .then((text) => {
        const isJson = text.trimStart().startsWith("{");
        return loadSpinePlayer(spineVersion).then((spine) => ({ spine, isJson }));
      })
      .then(({ spine, isJson }) => {
        if (cancelled || !mountRef.current) return;
        mountRef.current.innerHTML = "";
        const mount = document.createElement("div");
        mount.style.width = "100%";
        mount.style.height = "100%";
        mountRef.current.appendChild(mount);

        const config = {
          atlasUrl,
          alpha: true,
          premultipliedAlpha: false,
          mipmaps: false,
          backgroundColor,
          showControls: true,
          preserveDrawingBuffer: true,
          success: () => {
            if (!cancelled) setStatus("ready");
          },
          error: (err) => {
            console.error("Spine load failed", err);
            if (!cancelled) setStatus("error");
          },
        };
        // Use jsonUrl for JSON skeletons, skelUrl for binary.
        if (isJson) {
          config.jsonUrl = skelUrl;
        } else {
          config.skelUrl = skelUrl;
        }
        playerRef.current = new spine.SpinePlayer(mount, config);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      disposePlayer();
    };
  }, [id, baseUrl, backgroundColor, spineVersion]);

  // Release the previous player's WebGL context + DOM to avoid context leaks.
  function disposePlayer() {
    // Force-release the WebGL context so the browser frees the slot.
    const mount = mountRef.current;
    if (mount) {
      const canvas = mount.querySelector("canvas");
      if (canvas) {
        try {
          const gl =
            canvas.getContext("webgl2") ||
            canvas.getContext("webgl") ||
            canvas.getContext("experimental-webgl");
          if (gl && gl.getExtension) {
            const lose = gl.getExtension("WEBGL_lose_context");
            if (lose) lose.loseContext();
          }
        } catch (e) {
          /* ignore */
        }
      }
      mount.innerHTML = "";
    }
    playerRef.current = null;
  }

  return (
    <div className="spine-canvas-wrap">
      <div className="spine-toolbar">
        <span className="spine-status-chip">
          {status === "loading" && "Loading…"}
          {status === "ready" && id}
          {status === "error" && "Error"}
        </span>
        <div className="zoom-controls">
          <button
            onClick={() => setLocalZoom((z) => Math.max(0.2, +(z - 0.2).toFixed(2)))}
            title="Zoom out"
          >
            −
          </button>
          <span className="zoom-value">{Math.round(localZoom * 100)}%</span>
          <button
            onClick={() => setLocalZoom((z) => Math.min(5, +(z + 0.2).toFixed(2)))}
            title="Zoom in"
          >
            +
          </button>
          <button className="zoom-reset" onClick={() => setLocalZoom(zoom || 1)}>
            Reset
          </button>
        </div>
      </div>
      <div
        ref={mountRef}
        className="spine-canvas"
        style={{ background: backgroundColor }}
      />
    </div>
  );
}
