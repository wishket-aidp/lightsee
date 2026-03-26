use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // Handle files passed via CLI args (e.g. double-click on .md file)
            let args: Vec<String> = std::env::args().collect();
            if let Some(path) = args.get(1) {
                if path.ends_with(".md")
                    || path.ends_with(".markdown")
                    || path.ends_with(".mdown")
                    || path.ends_with(".mkd")
                    || path.ends_with(".mdwn")
                {
                    let path = path.clone();
                    let handle = app.handle().clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        let _ = handle.emit("open-file", path);
                    });
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = &event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    if let Some(path_str) = path.to_str() {
                        let _ = _app_handle.emit("open-file", path_str.to_string());
                    }
                }
            }
        }
        let _ = event;
    });
}
