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
export default function SpineCanvas({ id, baseUrl, backgroundColor, zoom }) {
  const mountRef = useRef(null);
  const playerRef = useRef(null);
  const rafRef = useRef(null);
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

    loadSpinePlayer()
      .then((spine) => {
        if (cancelled || !mountRef.current) return;
        mountRef.current.innerHTML = "";
        const mount = document.createElement("div");
        mount.style.width = "100%";
        mount.style.height = "100%";
        mountRef.current.appendChild(mount);

        playerRef.current = new spine.SpinePlayer(mount, {
          skelUrl: `${baseUrl}/${id}/${id}.skel`,
          atlasUrl: `${baseUrl}/${id}/${id}.atlas`,
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
        });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      disposePlayer();
    };
  }, [id, baseUrl, backgroundColor]);

  // Release the previous player's WebGL context + DOM to avoid context leaks.
  function disposePlayer() {
    // Cancel any rAF loop the player started.
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
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
