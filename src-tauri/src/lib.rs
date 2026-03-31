mod cloud;
mod share;

use std::sync::{Arc, Mutex};
use tauri_plugin_cli::CliExt;

pub(crate) fn normalize_path(path: &std::path::Path) -> String {
    let resolved = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let s = resolved.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    let s = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
    s
}

pub(crate) fn is_markdown_ext(path: &std::path::Path) -> bool {
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

#[derive(serde::Serialize, Clone)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<FileEntry>,
}

fn scan_markdown_dir(dir: &std::path::Path) -> Vec<FileEntry> {
    let mut entries = Vec::new();
    let Ok(read_dir) = std::fs::read_dir(dir) else {
        return entries;
    };

    let mut items: Vec<_> = read_dir.filter_map(|e| e.ok()).collect();
    items.sort_by(|a, b| {
        let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        b_is_dir.cmp(&a_is_dir).then_with(|| {
            a.file_name().to_string_lossy().to_lowercase().cmp(
                &b.file_name().to_string_lossy().to_lowercase(),
            )
        })
    });

    for item in items {
        let path = item.path();
        let name = item.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            let children = scan_markdown_dir(&path);
            if !children.is_empty() {
                entries.push(FileEntry {
                    name,
                    path: normalize_path(&path),
                    is_dir: true,
                    children,
                });
            }
        } else if is_markdown_ext(&path) {
            entries.push(FileEntry {
                name,
                path: normalize_path(&path),
                is_dir: false,
                children: Vec::new(),
            });
        }
    }
    entries
}

#[tauri::command]
fn list_markdown_files(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("{} is not a directory", path));
    }
    Ok(scan_markdown_dir(dir))
}

#[tauri::command]
async fn start_sharing(
    content: share::ContentPayload,
    state: tauri::State<'_, share::ShareManager>,
) -> Result<share::ShareInfo, String> {
    state.start(content, 3900).await
}

#[tauri::command]
async fn stop_sharing(
    state: tauri::State<'_, share::ShareManager>,
) -> Result<(), String> {
    state.stop().await
}

#[tauri::command]
async fn update_shared_content(
    content: share::ContentPayload,
    state: tauri::State<'_, share::ShareManager>,
) -> Result<(), String> {
    state.update_content(content).await
}

#[tauri::command]
async fn get_share_status(
    state: tauri::State<'_, share::ShareManager>,
) -> Result<share::ShareStatus, String> {
    Ok(state.status().await)
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_cli::init())
        .manage(PendingFiles(pending))
        .manage(share::ShareManager::new())
        .invoke_handler(tauri::generate_handler![
            get_pending_files, read_file, list_markdown_files,
            start_sharing, stop_sharing, update_shared_content, get_share_status,
            cloud::cloud_expose, cloud::cloud_list, cloud::cloud_remove
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Handle CLI subcommands
    if let Ok(matches) = app.cli().matches() {
        if let Some(ref subcmd) = matches.subcommand {
            let app_handle = app.handle().clone();
            match subcmd.name.as_str() {
                "expose" => {
                    let path = subcmd.matches.args.get("path")
                        .and_then(|a| a.value.as_str())
                        .map(|s: &str| s.to_string())
                        .expect("path argument required");

                    let path = std::path::Path::new(&path)
                        .canonicalize()
                        .unwrap_or_else(|_| std::path::PathBuf::from(&path))
                        .to_string_lossy()
                        .to_string();

                    tauri::async_runtime::block_on(async move {
                        match cloud::cloud_expose(app_handle, path, "light".to_string()).await {
                            Ok(result) => {
                                println!("Uploaded {} file(s). Share URL: {}", result.files_uploaded, result.url);
                                std::process::exit(0);
                            }
                            Err(e) => {
                                eprintln!("Error: {}", e);
                                std::process::exit(1);
                            }
                        }
                    });
                }
                "list" => {
                    tauri::async_runtime::block_on(async move {
                        match cloud::cloud_list(app_handle).await {
                            Ok(items) => {
                                if items.is_empty() {
                                    println!("No cloud shares.");
                                } else {
                                    for item in items {
                                        println!("{}\t{}\t{}\t{}", item.slug, item.share_type, item.local_path.unwrap_or_default(), item.updated_at);
                                    }
                                }
                                std::process::exit(0);
                            }
                            Err(e) => {
                                eprintln!("Error: {}", e);
                                std::process::exit(1);
                            }
                        }
                    });
                }
                "remove" => {
                    let slug = subcmd.matches.args.get("slug")
                        .and_then(|a| a.value.as_str())
                        .map(|s: &str| s.to_string())
                        .expect("slug argument required");

                    tauri::async_runtime::block_on(async move {
                        match cloud::cloud_remove(app_handle, slug).await {
                            Ok(()) => {
                                println!("Share removed.");
                                std::process::exit(0);
                            }
                            Err(e) => {
                                eprintln!("Error: {}", e);
                                std::process::exit(1);
                            }
                        }
                    });
                }
                _ => {}
            }
        }
    }

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
