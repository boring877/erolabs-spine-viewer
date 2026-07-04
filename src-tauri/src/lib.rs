// Erolabs Spine Viewer - Tauri backend (multi-game).
//
// Embeds one tiny_http server per game, each serving that game's extracted
// Spine animations (output/spine/<id>/{skel,atlas,png}) on its own localhost
// port. The frontend's Spine web player fetches assets from the selected
// game's server URL.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Manager, State};

/// All known games. Add a new game by appending one tuple here + rebuild:
///   (id, display name, spine directory, images directory for thumbnails)
fn games() -> Vec<(&'static str, &'static str, PathBuf, PathBuf)> {
    vec![
        (
            "zonenova",
            "Zone Nova",
            PathBuf::from("D:\\ZoneNova\\output\\spine"),
            PathBuf::from("D:\\ZoneNova\\output\\images"),
        ),
        (
            "sinphantom",
            "SIN Phantom",
            PathBuf::from("D:\\SINPhantom\\output\\spine"),
            PathBuf::from("D:\\SINPhantom\\output\\images"),
        ),
    ]
}

/// Find the first free localhost port starting from `base`.
fn find_free_port(base: u16) -> Option<u16> {
    (base..base + 200).find_map(|p| {
        TcpListener::bind(("127.0.0.1", p))
            .map(drop)
            .ok()
            .map(|_| p)
    })
}

/// Per-game config sent to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameInfo {
    pub id: String,
    pub name: String,
    pub server_base_url: String,
    pub thumbnail_base_url: String,
    pub spine_dir: String,
    pub animations: Vec<Animation>,
    pub found: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub games: Vec<GameInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Animation {
    pub id: String,
    pub kind: String, // "portrait" | "cg" | "other"
    pub has_png: bool,
    pub thumbnail: Option<String>, // relative path under images dir, e.g. "hash/CharIcon_3001.png"
}

/// Find a character icon thumbnail for an animation folder name. Searches the
/// images dir for an icon file matching the numeric character ID.
fn find_thumbnail(anim_id: &str, img_dir: &Path) -> Option<String> {
    // Extract the leading numeric character ID (e.g. "3001" from "3001_Chibi").
    let char_id: String = anim_id
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    if char_id.is_empty() {
        return None;
    }
    // Icon filename patterns to look for, in priority order.
    let patterns = [
        format!("CharIcon_{}.png", char_id),
        format!("Player_Icon_{}.png", char_id),
        format!("charicon_{}.png", char_id),
        format!("charicon_{}g.png", char_id),
        format!("player_icon_{}.png", char_id),
    ];
    // The images dir has hash-named subfolders; scan one level deep.
    if let Ok(subdirs) = std::fs::read_dir(img_dir) {
        for subdir in subdirs.flatten() {
            let subdir_path = subdir.path();
            if !subdir_path.is_dir() {
                continue;
            }
            let subdir_name = subdir.file_name();
            for pat in &patterns {
                let candidate = subdir_path.join(pat);
                if candidate.exists() {
                    return Some(format!("{}/{}", subdir_name.to_string_lossy(), pat));
                }
            }
        }
    }
    None
}

/// Classify an animation folder name into a display group.
fn classify(id: &str) -> &'static str {
    if id.contains("_CG") {
        "cg"
    } else if id.chars().all(|c| c.is_ascii_digit()) {
        "portrait"
    } else {
        "other"
    }
}

/// Shared state: game id -> (spine base URL, thumbnail base URL).
pub struct ServerUrls(pub Mutex<HashMap<String, (String, String)>>);

/// Map a file extension to a MIME type for HTTP responses.
fn mime_for(ext: &str) -> &'static str {
    match ext {
        "skel" => "application/octet-stream",
        "atlas" => "text/plain; charset=utf-8",
        "png" => "image/png",
        "json" => "application/json",
        _ => "application/octet-stream",
    }
}

/// Serve one Spine directory via tiny_http. Runs in a background thread.
fn spawn_server(dir: PathBuf, port: u16) {
    std::thread::spawn(move || {
        let addr = format!("127.0.0.1:{}", port);
        let server = match tiny_http::Server::http(&addr) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to bind HTTP server on {}: {}", addr, e);
                return;
            }
        };
        eprintln!("Spine asset server listening on http://{} ({})", addr, dir.display());
        for request in server.incoming_requests() {
            let url = request.url().to_string();
            let path_part = url.split('?').next().unwrap_or("");
            let rel = path_part.trim_start_matches('/');
            // Prevent path traversal.
            if rel.contains("..") {
                let _ = request.respond(tiny_http::Response::empty(404));
                continue;
            }
            let file_path = dir.join(rel);
            if file_path.is_file() {
                let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");
                let mime = mime_for(ext);
                match std::fs::read(&file_path) {
                    Ok(bytes) => {
                        let resp = tiny_http::Response::from_data(bytes)
                            .with_header(
                                tiny_http::Header::from_bytes(
                                    b"Content-Type".as_ref(),
                                    mime.as_bytes(),
                                )
                                .unwrap(),
                            )
                            .with_header(
                                tiny_http::Header::from_bytes(
                                    b"Access-Control-Allow-Origin".as_ref(),
                                    b"*",
                                )
                                .unwrap(),
                            );
                        let _ = request.respond(resp);
                    }
                    Err(_) => {
                        let _ = request.respond(tiny_http::Response::empty(500));
                    }
                }
            } else {
                let _ = request.respond(tiny_http::Response::empty(404));
            }
        }
    });
}

/// Scan a Spine directory and build the animation list. Also looks up a
/// thumbnail (character icon) for each animation in the sibling images dir.
fn scan_animations(dir: &Path, img_dir: &Path) -> Vec<Animation> {
    let mut out = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let id = entry.file_name().to_string_lossy().to_string();
            let skel = path.join(format!("{}.skel", id));
            if !skel.exists() {
                continue;
            }
            let has_png = path.join(format!("{}.png", id)).exists();
            // Look up a thumbnail (character icon) for this animation. The
            // numeric character ID is extracted from the folder name.
            let thumb = find_thumbnail(&id, img_dir);
            out.push(Animation {
                id,
                kind: classify(&entry.file_name().to_string_lossy()).to_string(),
                has_png,
                thumbnail: thumb,
            });
        }
    }
    // Sort: portraits first (numeric), then CGs, then other.
    out.sort_by(|a, b| {
        let prio = |k: &str| match k {
            "portrait" => 0,
            "cg" => 1,
            _ => 2,
        };
        prio(&a.kind)
            .cmp(&prio(&b.kind))
            .then_with(|| a.id.cmp(&b.id))
    });
    out
}

/// Frontend command: get the app config (all games + their servers).
#[tauri::command]
fn get_app_config(state: State<'_, ServerUrls>) -> AppConfig {
    let urls = state.0.lock().unwrap();
    let mut game_infos = Vec::new();
    for (id, name, dir, img_dir) in games() {
        let found = dir.is_dir();
        let animations = if found { scan_animations(&dir, &img_dir) } else { Vec::new() };
        let found = found && !animations.is_empty();
        let (server_base_url, thumbnail_base_url) =
            urls.get(id).cloned().unwrap_or_default();
        game_infos.push(GameInfo {
            id: id.to_string(),
            name: name.to_string(),
            server_base_url,
            thumbnail_base_url,
            spine_dir: dir.to_string_lossy().to_string(),
            animations,
            found,
        });
    }
    AppConfig { games: game_infos }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Start one spine HTTP server + one thumbnail HTTP server per game.
    let mut urls: HashMap<String, (String, String)> = HashMap::new();
    let mut next_port: u16 = 8899;
    for (id, _name, dir, img_dir) in games() {
        if !dir.is_dir() {
            eprintln!("Skipping server for '{}': {} not found", id, dir.display());
            continue;
        }
        let spine_url = match find_free_port(next_port) {
            Some(port) => {
                spawn_server(dir, port);
                next_port = port + 1;
                format!("http://127.0.0.1:{}", port)
            }
            None => String::new(),
        };
        // Thumbnail server: serves the game's images/ dir so the sidebar can
        // show character icons. Falls back to the spine server if no image dir.
        let thumb_url = if img_dir.is_dir() {
            match find_free_port(next_port) {
                Some(port) => {
                    spawn_server(img_dir, port);
                    next_port = port + 1;
                    format!("http://127.0.0.1:{}", port)
                }
                None => spine_url.clone(),
            }
        } else {
            spine_url.clone()
        };
        urls.insert(id.to_string(), (spine_url, thumb_url));
    }

    tauri::Builder::default()
        .manage(ServerUrls(Mutex::new(urls)))
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(600));
                let _ = window.show();
                let _ = window.set_focus();
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_app_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
