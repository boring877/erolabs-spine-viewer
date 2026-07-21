import { useEffect, useRef, useState } from "react";
import { loadSpinePlayer } from "../spinePlayerLoader.js";

// Renders one Spine character using the official web player.
//
// The player's built-in controls (showControls: true) handle zoom/pan/viewport
// auto-fit natively — this gives the best rendering quality at all zoom levels.
//
// The parent receives the player instance via onReady() so it can build custom
// animation controls in the right panel.
//
// WebGL context leak prevention: browsers cap ~16 contexts. On cleanup we
// force-release via WEBGL_lose_context.
export default function SpineCanvas({ id, baseUrl, backgroundColor, spineVersion = "4.1", onReady }) {
  const mountRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMsg("");

    // URL-encode the id to handle spaces in folder names like "4037 CG1".
    const encodedId = encodeURIComponent(id);
    const skelUrl = `${baseUrl}/${encodedId}/${encodedId}.skel`;
    const atlasUrl = `${baseUrl}/${encodedId}/${encodedId}.atlas`;

    // Detect JSON vs binary skeleton by checking the first byte.
    fetch(skelUrl)
      .then((r) => r.text())
      .then((text) => {
        const isJson = text.trimStart().startsWith("{");
        return loadSpinePlayer(spineVersion).then((spine) => ({ spine, isJson }));
      })
      .then(({ spine, isJson }) => {
        if (cancelled || !mountRef.current) return;

        // Clear any previous player.
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
          // Use the player's built-in controls for zoom/pan/viewport.
          // This gives native-quality rendering at all zoom levels.
          showControls: true,
          preserveDrawingBuffer: true,
          success: (player) => {
            if (cancelled) return;
            setStatus("ready");
            // Extract animations from the skeleton data.
            const anims = player.skeleton?.data?.animations?.map((a) => a.name) || [];
            // Notify parent so it can populate the right panel.
            if (onReady) onReady(player, anims);
          },
          error: (_player, msg) => {
            console.error("Spine load failed:", msg, "for character:", id);
            if (!cancelled) {
              setStatus("error");
              setErrorMsg(msg || "Unknown error");
            }
          },
        };

        // JSON skeletons use jsonUrl; binary use skelUrl.
        if (isJson) {
          config.jsonUrl = skelUrl;
        } else {
          config.skelUrl = skelUrl;
        }

        playerRef.current = new spine.SpinePlayer(mount, config);
      })
      .catch((err) => {
        console.error("SpineCanvas error:", err);
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(String(err.message || err));
        }
      });

    return () => {
      cancelled = true;
      disposePlayer();
      if (onReady) onReady(null, []);
    };
  }, [id, baseUrl, spineVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Release the WebGL context to prevent context leaks.
  function disposePlayer() {
    const mount = mountRef.current;
    if (!mount) return;

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
        // ignore
      }
    }
    mount.innerHTML = "";
    playerRef.current = null;
  }

  return (
    <div className="spine-canvas-wrap">
      {status === "error" && (
        <div className="spine-error-overlay">
          <div className="spine-error-box">
            <strong>Failed to load</strong>
            <p>{errorMsg}</p>
            <p className="spine-error-id">{id}</p>
          </div>
        </div>
      )}
      <div
        ref={mountRef}
        className="spine-canvas"
        style={{ background: backgroundColor }}
      />
    </div>
  );
}
