// Zone Nova Spine Viewer - Tauri backend.
//
// Embeds a tiny HTTP server that serves the extracted Spine animations
// (output/spine/<id>/{skel,atlas,png}) on 127.0.0.1:<port>. The frontend's
// Spine web player fetches assets via URL from this server - the same pattern
// that works in serve_spine.py, moved into Rust.

use serde::{Deserialize, Serialize};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Manager, State};

/// Where the extractor wrote the clean Spine assets.
/// The viewer reads from the sibling `output/spine/` of the extractor repo.
fn spine_dir() -> PathBuf {
    PathBuf::from("D:\\ZoneNova\\output\\spine")
}

/// Find the first free localhost port starting from `base`.
fn find_free_port(base: u16) -> Option<u16> {
    (base..base + 100).find_map(|p| {
        TcpListener::bind(("127.0.0.1", p)).map(|l| drop(l)).ok().map(|_| p)
    })
}

/// App configuration sent to the frontend on startup.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub server_base_url: String,
    pub spine_dir: String,
    pub animations: Vec<Animation>,
    pub found: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Animation {
    pub id: String,
    pub kind: String, // "portrait" | "cg" | "other"
    pub has_png: bool,
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

/// Shared state: the base URL of the embedded HTTP server (set on startup).
pub struct ServerUrl(pub Mutex<String>);

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

/// Serve the Spine directory via tiny_http. Runs in a background thread.
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
        eprintln!("Spine asset server listening on http://{}", addr);
        for request in server.incoming_requests() {
            // URL path like "/3001/3001.skel" -> serve dir/3001/3001.skel
            let url = request.url().to_string();
            // Strip query string.
            let path_part = url.split('?').next().unwrap_or("");
            // Normalize: prevent path traversal.
            let rel = path_part.trim_start_matches('/');
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

/// Scan the Spine directory and build the animation list.
fn scan_animations(dir: &Path) -> Vec<Animation> {
    let mut out = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let id = entry.file_name().to_string_lossy().to_string();
            // Require a .skel (the defining file of a Spine animation).
            let skel = path.join(format!("{}.skel", id));
            if !skel.exists() {
                continue;
            }
            let has_png = path.join(format!("{}.png", id)).exists();
            out.push(Animation {
                id,
                kind: classify(&entry.file_name().to_string_lossy()).to_string(),
                has_png,
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

/// Frontend command: get the app config (server URL + animation list).
#[tauri::command]
fn get_app_config(state: State<'_, ServerUrl>) -> AppConfig {
    let dir = spine_dir();
    let base = state.0.lock().unwrap().clone();
    let animations = scan_animations(&dir);
    let found = dir.is_dir() && !animations.is_empty();
    AppConfig {
        server_base_url: base,
        spine_dir: dir.to_string_lossy().to_string(),
        animations,
        found,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let dir = spine_dir();
    let port = find_free_port(8899).unwrap_or(8899);
    let base_url = format!("http://127.0.0.1:{}", port);

    // Start the asset server in the background before the window opens.
    spawn_server(dir, port);

    tauri::Builder::default()
        .manage(ServerUrl(Mutex::new(base_url)))
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
