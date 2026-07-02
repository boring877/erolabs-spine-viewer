import { useEffect, useRef, useState } from "react";
import { loadSpinePlayer } from "../spinePlayerLoader.js";

// Renders one Spine animation into a container div using the official web
// player. Re-mounts whenever `id` or `baseUrl` changes.
export default function SpineCanvas({ id, baseUrl }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    loadSpinePlayer()
      .then((spine) => {
        if (cancelled || !containerRef.current) return;

        // Tear down any previous player instance in this container.
        containerRef.current.innerHTML = "";
        const mount = document.createElement("div");
        mount.style.width = "100%";
        mount.style.height = "100%";
        containerRef.current.appendChild(mount);

        const skelUrl = `${baseUrl}/${id}/${id}.skel`;
        const atlasUrl = `${baseUrl}/${id}/${id}.atlas`;

        playerRef.current = new spine.SpinePlayer(mount, {
          skelUrl,
          atlasUrl,
          alpha: true,
          premultipliedAlpha: false, // Zone Nova textures are straight-alpha
          mipmaps: false,
          backgroundColor: "#1a1a2e",
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
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [id, baseUrl]);

  return (
    <div className="spine-canvas-wrap">
      <div className="spine-status">
        {status === "loading" && `Loading ${id}...`}
        {status === "ready" && `${id} - loaded`}
        {status === "error" && `Error loading ${id} (check console)`}
      </div>
      <div ref={containerRef} className="spine-canvas" />
    </div>
  );
}
