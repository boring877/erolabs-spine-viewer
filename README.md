# Zone Nova Spine Viewer

A standalone desktop app for browsing Zone Nova's Spine character animations at game quality.

Part of the [GachaWiki](https://github.com/boring877/gacha-wiki) Zone Nova tooling, alongside the [extractor](https://github.com/boring877/zonenova-extractor).

## What it does

- Native Windows window (Tauri v2) — no browser, no terminal
- Browse all 157 Spine animations (character portraits + animated CGs)
- Searchable sidebar grouped by type (Portraits / CGs / Other)
- Renders at full game quality using the official Spine 4.1 web player
- Animation controls (switch animation, play/pause, speed)

## How it works

The app embeds a tiny HTTP server (`tiny_http`) that serves the extracted Spine
assets (`.skel` + `.atlas` + `.png`) on `127.0.0.1:<port>` at startup. The
frontend's Spine web player fetches assets from this local server — the same
proven pattern as `serve_spine.py`, moved into the Rust backend.

Key rendering config (the result of reverse-engineering the format):
- Spine runtime: `@esotericsoftware/spine-player@4.1.52` (jsdelivr CDN)
- `skelUrl`/`atlasUrl` — binary `.skel` skeleton (Spine 4.1.24 format)
- `premultipliedAlpha: false` — Zone Nova textures are **straight-alpha** (not premultiplied). Setting this wrong washes out the colors.
- `alpha: true`, dark background

## Prerequisites

The viewer reads from the extractor's output at `D:\ZoneNova\output\spine\`.
Run the extractor first to generate the clean Spine assets:

```bash
cd D:\ZoneNova
python extract.py          # extract everything (creates output/spine via extract_spine.py)
python extract_spine.py    # re-extract Spine animations cleanly (binary-safe)
```

## Development

```bash
cd spine-viewer
bun install
bun tauri dev      # run in dev mode (opens window)
bun tauri build    # produce the .exe installer
```

## Stack

- **Tauri v2** (Rust backend) + **React 19** + **Vite 6**
- `tiny_http` for the embedded asset server
- Official Spine web player (4.1) for rendering
