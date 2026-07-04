# Erolabs Spine Viewer

A standalone desktop app for browsing Spine character animations from Erolabs gacha games at game quality. Currently supports **Zone Nova** and **SIN Phantom** — both use the identical Spine 4.1 format.

Part of the [GachaWiki](https://github.com/boring877/gacha-wiki) tooling family.

## Features

- **Multi-game**: a dropdown switches between Zone Nova (157 animations) and SIN Phantom (107)
- **Native window** (Tauri v2) — no browser, no terminal
- **Character thumbnails** in the sidebar
- **Zoom controls** (+/−, reset) applied to the canvas
- **In-app settings** (background color, default zoom, thumbnails) — persisted across sessions
- **Spine player controls** at the bottom (animation switch, play/pause, speed)
- Renders at full game quality using the official Spine 4.1 web player

## How it works

Each game gets **two embedded HTTP servers** (via `tiny_http` in the Rust backend):
- a spine server serving `output/spine/<id>/{skel,atlas,png}`
- a thumbnail server serving `output/images/` for sidebar icons

The frontend's Spine web player fetches assets from the selected game's server URL. On character switch, the previous player's WebGL context is force-released (`WEBGL_lose_context`) to avoid the browser's ~16-context cap.

Key rendering config (the result of reverse-engineering the format):
- Spine runtime: `@esotericsoftware/spine-player@4.1.52` (jsdelivr CDN)
- `skelUrl`/`atlasUrl` — binary `.skel` skeleton (Spine 4.1.24 format)
- `premultipliedAlpha: false` — these textures are **straight-alpha**

## Adding a new game

One line in `games()` in `src-tauri/src/lib.rs` + rebuild:

```rust
("mygame", "My Game", PathBuf::from("D:\\MyGame\\output\\spine"), PathBuf::from("D:\\MyGame\\output\\images")),
```

A new spine server + thumbnail server spawn automatically, and the game appears in the dropdown.

## Prerequisites

The viewer reads from each game's extractor output:
- `D:\ZoneNova\output\spine\` + `D:\ZoneNova\output\images\`
- `D:\SINPhantom\output\spine\` + `D:\SINPhantom\output\images\`

Run each game's extractor first (see the game-specific extractor repos).

## Development

```bash
cd spine-viewer
bun install
bun tauri dev      # run in dev mode
bun tauri build    # produce the .exe installer
```

## Stack

- **Tauri v2** (Rust) + **React 19** + **Vite 6**
- `tiny_http` for the embedded asset servers (one spine + one thumbnails per game)
- Official Spine web player (4.1) for rendering
