use std::sync::{Arc, Mutex};

fn normalize_path(path: &std::path::Path) -> String {
    let resolved = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let s = resolved.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    let s = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
    s
}

fn is_markdown_ext(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| matches!(ext.to_lowercase().as_str(), "md" | "markdown" | "mdown" | "mkd" | "mdwn"))
        .unwrap_or(false)
}

struct PendingFiles(Arc<Mutex<Vec<String>>>);

#[tauri::command]
fn get_pending_files(state: tauri::State<PendingFiles>) -> Vec<String> {
    let mut lock = state.0.lock().unwrap();
    lock.drain(..).collect()
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pending = Arc::new(Mutex::new(Vec::new()));

    let args: Vec<String> = std::env::args().collect();
    if let Some(path_arg) = args.get(1) {
        let path = std::path::Path::new(path_arg);
        if is_markdown_ext(path) {
            pending.lock().unwrap().push(normalize_path(path));
        }
    }

    let pending_for_event = pending.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(PendingFiles(pending))
        .invoke_handler(tauri::generate_handler![get_pending_files, read_file])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }), .. } = &event {
            for path in paths {
                if is_markdown_ext(path) {
                    pending_for_event.lock().unwrap().push(normalize_path(path));
                }
            }
        }

        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = &event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    if let Some(path_str) = path.to_str() {
                        pending_for_event.lock().unwrap().push(path_str.to_string());
                    }
                }
            }
        }
        let _ = event;
    });
}
