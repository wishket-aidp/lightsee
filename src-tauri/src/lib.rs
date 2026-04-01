mod cloud;

use std::sync::{Arc, Mutex};
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::Emitter;
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
        .setup(|app| {
            let check_update = MenuItemBuilder::with_id("check_update", "Check for Updates...")
                .build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "Lightsee")
                .item(&PredefinedMenuItem::about(app, Some("About Lightsee"), None)?)
                .separator()
                .item(&check_update)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .item(&view_submenu)
                .item(&window_submenu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if event.id() == check_update.id() {
                    let handle = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = handle.emit("check-update", ());
                    });
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_cli::init())
        .manage(PendingFiles(pending))
        .invoke_handler(tauri::generate_handler![
            get_pending_files, read_file, list_markdown_files,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn create_temp_dir(prefix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lightsee_test_{}_{}", prefix, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    // ── is_markdown_ext ────────────────────────────────────────────

    #[test]
    fn is_markdown_ext_supported_extensions() {
        for ext in &["md", "markdown", "mdown", "mkd", "mdwn"] {
            let path = PathBuf::from(format!("file.{}", ext));
            assert!(is_markdown_ext(&path), "expected true for .{}", ext);
        }
    }

    #[test]
    fn is_markdown_ext_non_markdown() {
        for name in &["file.txt", "file.html", "file.rs", "noext"] {
            let path = PathBuf::from(name);
            assert!(!is_markdown_ext(&path), "expected false for {}", name);
        }
    }

    // ── scan_markdown_dir ──────────────────────────────────────────

    #[test]
    fn scan_markdown_dir_basic_structure() {
        let dir = create_temp_dir("scan_basic");
        fs::write(dir.join("alpha.md"), "# Alpha").unwrap();
        fs::write(dir.join("beta.markdown"), "# Beta").unwrap();
        let sub = dir.join("subdir");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("gamma.md"), "# Gamma").unwrap();

        let entries = scan_markdown_dir(&dir);

        // Directories come first, then files sorted alphabetically
        assert_eq!(entries.len(), 3);

        let subdir_entry = entries.iter().find(|e| e.name == "subdir").unwrap();
        assert!(subdir_entry.is_dir);
        assert_eq!(subdir_entry.children.len(), 1);
        assert_eq!(subdir_entry.children[0].name, "gamma.md");

        let alpha = entries.iter().find(|e| e.name == "alpha.md").unwrap();
        assert!(!alpha.is_dir);
        assert!(alpha.children.is_empty());

        let beta = entries.iter().find(|e| e.name == "beta.markdown").unwrap();
        assert!(!beta.is_dir);

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn scan_markdown_dir_excludes_hidden_files() {
        let dir = create_temp_dir("scan_hidden");
        fs::write(dir.join("visible.md"), "ok").unwrap();
        fs::write(dir.join(".hidden.md"), "hidden").unwrap();
        let hidden_dir = dir.join(".hidden_dir");
        fs::create_dir_all(&hidden_dir).unwrap();
        fs::write(hidden_dir.join("inside.md"), "inside").unwrap();

        let entries = scan_markdown_dir(&dir);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "visible.md");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn scan_markdown_dir_excludes_empty_directories() {
        let dir = create_temp_dir("scan_empty");
        fs::write(dir.join("file.md"), "ok").unwrap();
        let empty = dir.join("empty_dir");
        fs::create_dir_all(&empty).unwrap();

        let entries = scan_markdown_dir(&dir);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "file.md");

        fs::remove_dir_all(&dir).unwrap();
    }

    // ── read_file ──────────────────────────────────────────────────

    #[test]
    fn read_file_existing() {
        let dir = create_temp_dir("read_ok");
        let path = dir.join("test.md");
        fs::write(&path, "hello world").unwrap();

        let result = read_file(path.to_string_lossy().to_string());
        assert_eq!(result.unwrap(), "hello world");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn read_file_nonexistent() {
        let result = read_file("/tmp/lightsee_nonexistent_12345.md".to_string());
        assert!(result.is_err());
    }

    // ── is_markdown_ext edge cases ────────────────────────────────────

    #[test]
    fn is_markdown_ext_case_insensitive() {
        assert!(is_markdown_ext(&PathBuf::from("file.MD")));
        assert!(is_markdown_ext(&PathBuf::from("file.Md")));
        assert!(is_markdown_ext(&PathBuf::from("file.MARKDOWN")));
    }

    #[test]
    fn is_markdown_ext_no_extension() {
        assert!(!is_markdown_ext(&PathBuf::from("README")));
        assert!(!is_markdown_ext(&PathBuf::from(".")));
    }

    #[test]
    fn is_markdown_ext_double_extension() {
        // Only checks the final extension
        assert!(is_markdown_ext(&PathBuf::from("file.txt.md")));
        assert!(!is_markdown_ext(&PathBuf::from("file.md.txt")));
    }

    // ── scan_markdown_dir additional tests ────────────────────────────

    #[test]
    fn scan_markdown_dir_sorts_dirs_before_files() {
        let dir = create_temp_dir("scan_sort");
        fs::write(dir.join("z_file.md"), "file").unwrap();
        let subdir = dir.join("a_dir");
        fs::create_dir_all(&subdir).unwrap();
        fs::write(subdir.join("inner.md"), "inner").unwrap();

        let entries = scan_markdown_dir(&dir);
        assert_eq!(entries.len(), 2);
        // Directory should come first
        assert!(entries[0].is_dir, "first entry should be directory");
        assert_eq!(entries[0].name, "a_dir");
        assert!(!entries[1].is_dir, "second entry should be file");
        assert_eq!(entries[1].name, "z_file.md");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn scan_markdown_dir_sorts_alphabetically() {
        let dir = create_temp_dir("scan_alpha");
        fs::write(dir.join("charlie.md"), "c").unwrap();
        fs::write(dir.join("alpha.md"), "a").unwrap();
        fs::write(dir.join("bravo.md"), "b").unwrap();

        let entries = scan_markdown_dir(&dir);
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].name, "alpha.md");
        assert_eq!(entries[1].name, "bravo.md");
        assert_eq!(entries[2].name, "charlie.md");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn scan_markdown_dir_ignores_non_markdown() {
        let dir = create_temp_dir("scan_nonmd");
        fs::write(dir.join("doc.md"), "md").unwrap();
        fs::write(dir.join("image.png"), "png").unwrap();
        fs::write(dir.join("script.js"), "js").unwrap();
        fs::write(dir.join("style.css"), "css").unwrap();

        let entries = scan_markdown_dir(&dir);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "doc.md");

        fs::remove_dir_all(&dir).unwrap();
    }

    // ── read_file additional tests ────────────────────────────────────

    #[test]
    fn read_file_utf8_content() {
        let dir = create_temp_dir("read_utf8");
        let path = dir.join("korean.md");
        fs::write(&path, "# 한글 제목\n\n본문 내용").unwrap();

        let result = read_file(path.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert!(result.unwrap().contains("한글 제목"));

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn read_file_empty_file() {
        let dir = create_temp_dir("read_empty");
        let path = dir.join("empty.md");
        fs::write(&path, "").unwrap();

        let result = read_file(path.to_string_lossy().to_string());
        assert_eq!(result.unwrap(), "");

        fs::remove_dir_all(&dir).unwrap();
    }
}
