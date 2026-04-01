use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri_plugin_store::StoreExt;

const SUPABASE_URL: &str = "https://orrbxkptrkkibggjxhmh.supabase.co";
const SUPABASE_ANON_KEY: &str = "sb_publishable_XA3MvZtQyzmejLdLavGHeQ_aisNX2Ou";
const EDGE_FUNCTION_URL: &str = "https://orrbxkptrkkibggjxhmh.supabase.co/functions/v1/issue-api-key";
const STORAGE_BUCKET: &str = "lightsee-files";
const PUBLIC_VIEWER_URL: &str = "https://viewer.ai-delivery.work";

const MAX_FILES: usize = 200;
const MAX_FILE_SIZE: u64 = 5 * 1024 * 1024; // 5MB

// ── Data types ──────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize)]
struct CloudCredentials {
    api_key: String,
    api_key_id: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct CloudShareRecord {
    local_path: String,
    share_id: String,
    slug: String,
    share_type: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CloudShareResult {
    pub url: String,
    pub slug: String,
    pub share_id: String,
    pub files_uploaded: usize,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CloudShareListItem {
    pub slug: String,
    pub title: String,
    pub share_type: String,
    pub local_path: Option<String>,
    pub url: String,
    pub updated_at: String,
}

// Supabase REST response types
#[derive(Deserialize)]
struct SupabaseShare {
    id: String,
    slug: String,
    title: Option<String>,
    #[serde(rename = "type")]
    share_type: String,
    updated_at: Option<String>,
}

#[derive(Deserialize)]
struct EdgeFunctionResponse {
    api_key: String,
    api_key_id: String,
}

// ── Helper functions ────────────────────────────────────────────────

/// Convert a path segment to an ASCII-safe storage key.
/// Non-ASCII segments (e.g. Korean filenames) are replaced with a short hash,
/// preserving the file extension for content-type detection.
fn ascii_safe_segment(seg: &str) -> String {
    if seg.is_ascii() {
        return seg.to_string();
    }
    let hash = Sha256::digest(seg.as_bytes());
    let short_hash = format!("{:x}", hash);
    let short_hash = &short_hash[..16];
    // Preserve extension if present
    match seg.rfind('.') {
        Some(dot) => {
            let ext = &seg[dot..];
            if ext.is_ascii() {
                format!("{}{}", short_hash, ext)
            } else {
                short_hash.to_string()
            }
        }
        None => short_hash.to_string(),
    }
}

fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn generate_slug() -> String {
    nanoid::nanoid!(10)
}

fn collect_markdown_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    collect_markdown_files_recursive(dir, &mut files);
    files
}

fn collect_markdown_files_recursive(dir: &Path, files: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        // Skip hidden files/dirs
        if name_str.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_markdown_files_recursive(&path, files);
        } else if crate::is_markdown_ext(&path) {
            files.push(path);
        }

        if files.len() >= MAX_FILES {
            return;
        }
    }
}

fn ensure_api_key(app: &tauri::AppHandle) -> Result<CloudCredentials, String> {
    let store = app
        .store("settings.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;

    // Check for existing credentials
    if let Some(val) = store.get("cloud_credentials") {
        if let Ok(creds) = serde_json::from_value::<CloudCredentials>(val) {
            return Ok(creds);
        }
    }

    // Request new API key from edge function
    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(EDGE_FUNCTION_URL)
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .map_err(|e| format!("Failed to request API key: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Edge function returned status {}",
            resp.status()
        ));
    }

    let edge_resp: EdgeFunctionResponse = resp
        .json()
        .map_err(|e| format!("Failed to parse edge function response: {}", e))?;

    let creds = CloudCredentials {
        api_key: edge_resp.api_key,
        api_key_id: edge_resp.api_key_id,
    };

    store.set(
        "cloud_credentials",
        serde_json::to_value(&creds).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(creds)
}

fn get_share_records(app: &tauri::AppHandle) -> Vec<CloudShareRecord> {
    let Ok(store) = app.store("settings.json") else {
        return Vec::new();
    };
    store
        .get("cloud_shares")
        .and_then(|v| serde_json::from_value::<Vec<CloudShareRecord>>(v).ok())
        .unwrap_or_default()
}

fn find_existing_share(app: &tauri::AppHandle, local_path: &str) -> Option<CloudShareRecord> {
    get_share_records(app)
        .into_iter()
        .find(|r| r.local_path == local_path)
}

fn save_share_record(app: &tauri::AppHandle, record: CloudShareRecord) -> Result<(), String> {
    let store = app
        .store("settings.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let mut records = get_share_records(app);

    // Replace existing record for same local_path, or append
    if let Some(pos) = records.iter().position(|r| r.local_path == record.local_path) {
        records[pos] = record;
    } else {
        records.push(record);
    }

    store.set(
        "cloud_shares",
        serde_json::to_value(&records).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;
    Ok(())
}

fn remove_share_record(app: &tauri::AppHandle, slug: &str) -> Result<(), String> {
    let store = app
        .store("settings.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let mut records = get_share_records(app);
    records.retain(|r| r.slug != slug);

    store.set(
        "cloud_shares",
        serde_json::to_value(&records).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;
    Ok(())
}

// ── Supabase REST helpers ───────────────────────────────────────────

fn supabase_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::new()
}

fn supabase_rest_url(table: &str) -> String {
    format!("{}/rest/v1/{}", SUPABASE_URL, table)
}

fn storage_url(path: &str) -> String {
    format!(
        "{}/storage/v1/object/{}/{}",
        SUPABASE_URL, STORAGE_BUCKET, path
    )
}

// ── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub async fn cloud_expose(
    app: tauri::AppHandle,
    path: String,
    theme: String,
) -> Result<CloudShareResult, String> {
    // Run blocking work on a background thread
    tokio::task::spawn_blocking(move || cloud_expose_inner(&app, &path, &theme))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn cloud_expose_inner(
    app: &tauri::AppHandle,
    path: &str,
    theme: &str,
) -> Result<CloudShareResult, String> {
    let creds = ensure_api_key(app)?;
    let key_hash = hash_api_key(&creds.api_key);

    let local_path = crate::normalize_path(Path::new(path));
    let dir = Path::new(&local_path);

    // Collect files
    let files = if dir.is_dir() {
        collect_markdown_files(dir)
    } else if crate::is_markdown_ext(dir) {
        vec![dir.to_path_buf()]
    } else {
        return Err("Path is not a markdown file or directory".into());
    };

    if files.is_empty() {
        return Err("No markdown files found".into());
    }
    if files.len() > MAX_FILES {
        return Err(format!("Too many files (max {})", MAX_FILES));
    }

    // Check file sizes
    for f in &files {
        let meta = std::fs::metadata(f).map_err(|e| format!("Cannot read {}: {}", f.display(), e))?;
        if meta.len() > MAX_FILE_SIZE {
            return Err(format!("File {} exceeds 5MB limit", f.display()));
        }
    }

    // Determine share type & title
    let share_type = if dir.is_dir() { "folder" } else { "file" };
    let title = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    // Check for existing share (re-push)
    let existing = find_existing_share(app, &local_path);
    let client = supabase_client();

    let (share_id, slug): (String, String) = if let Some(ref rec) = existing {
        // Update existing share
        let body = serde_json::json!({
            "title": title,
            "theme": theme,
            "type": share_type,
        });

        let resp = client
            .patch(&format!(
                "{}?id=eq.{}&api_key_id=eq.{}",
                supabase_rest_url("shares"),
                rec.share_id,
                creds.api_key_id
            ))
            .header("apikey", SUPABASE_ANON_KEY)

            .header("Content-Type", "application/json")
            .header("Prefer", "return=representation")
            .header("x-api-key-hash", &key_hash)
            .json(&body)
            .send()
            .map_err(|e| format!("Failed to update share: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().unwrap_or_default();
            return Err(format!("Failed to update share ({}): {}", status, text));
        }

        (rec.share_id.clone(), rec.slug.clone())
    } else {
        // Create new share
        let slug = generate_slug();
        let body = serde_json::json!({
            "slug": slug,
            "api_key_id": creds.api_key_id,
            "title": title,
            "theme": theme,
            "type": share_type,
        });

        let resp = client
            .post(supabase_rest_url("shares"))
            .header("apikey", SUPABASE_ANON_KEY)

            .header("Content-Type", "application/json")
            .header("Prefer", "return=representation")
            .header("x-api-key-hash", &key_hash)
            .json(&body)
            .send()
            .map_err(|e| format!("Failed to create share: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().unwrap_or_default();
            return Err(format!("Failed to create share ({}): {}", status, text));
        }

        let shares: Vec<SupabaseShare> = resp
            .json()
            .map_err(|e| format!("Failed to parse share response: {}", e))?;
        let share = shares
            .into_iter()
            .next()
            .ok_or("No share returned from API")?;

        (share.id, slug)
    };

    // Delete old share_files records for this share
    let _ = client
        .delete(&format!(
            "{}?share_id=eq.{}",
            supabase_rest_url("share_files"),
            share_id
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("x-api-key-hash", &key_hash)
        .send();

    // Upload files and insert share_files records
    let base_dir = if dir.is_dir() { dir } else { dir.parent().unwrap_or(dir) };
    let mut files_uploaded = 0;

    for file_path in &files {
        let content = std::fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;

        // Compute relative path for storage
        let rel_path = file_path
            .strip_prefix(base_dir)
            .unwrap_or(file_path)
            .to_string_lossy()
            .replace('\\', "/");

        // Convert non-ASCII path segments to ASCII-safe hashed names for storage
        let safe_rel_path = rel_path
            .split('/')
            .map(|seg| ascii_safe_segment(seg))
            .collect::<Vec<_>>()
            .join("/");

        let storage_path = format!("{}/{}", share_id, safe_rel_path);

        // Upload to Supabase Storage
        let resp = client
            .post(&storage_url(&storage_path))
            .header("apikey", SUPABASE_ANON_KEY)

            .header("Content-Type", "text/markdown")
            .header("x-upsert", "true")
            .body(content)
            .send()
            .map_err(|e| format!("Failed to upload {}: {}", rel_path, e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().unwrap_or_default();
            return Err(format!(
                "Failed to upload {} ({}): {}",
                rel_path, status, text
            ));
        }

        // Insert share_files record
        let file_record = serde_json::json!({
            "share_id": share_id,
            "path": rel_path,
            "storage_path": storage_path,
            "size_bytes": std::fs::metadata(file_path).map(|m| m.len()).unwrap_or(0),
        });

        let resp = client
            .post(supabase_rest_url("share_files"))
            .header("apikey", SUPABASE_ANON_KEY)

            .header("Content-Type", "application/json")
            .header("x-api-key-hash", &key_hash)
            .json(&file_record)
            .send()
            .map_err(|e| format!("Failed to insert file record: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().unwrap_or_default();
            return Err(format!(
                "Failed to insert file record ({}): {}",
                status, text
            ));
        }

        files_uploaded += 1;
    }

    // Save local record
    let record = CloudShareRecord {
        local_path: local_path.clone(),
        share_id: share_id.clone(),
        slug: slug.clone(),
        share_type: share_type.to_string(),
    };
    save_share_record(app, record)?;

    let url = format!("{}/s/{}", PUBLIC_VIEWER_URL, slug);

    Ok(CloudShareResult {
        url,
        slug,
        share_id,
        files_uploaded,
    })
}

#[tauri::command]
pub async fn cloud_list(app: tauri::AppHandle) -> Result<Vec<CloudShareListItem>, String> {
    tokio::task::spawn_blocking(move || cloud_list_inner(&app))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn cloud_list_inner(app: &tauri::AppHandle) -> Result<Vec<CloudShareListItem>, String> {
    let creds = ensure_api_key(app)?;
    let key_hash = hash_api_key(&creds.api_key);

    let client = supabase_client();
    let resp = client
        .get(&format!(
            "{}?api_key_id=eq.{}&order=updated_at.desc",
            supabase_rest_url("shares"),
            creds.api_key_id
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("x-api-key-hash", &key_hash)
        .send()
        .map_err(|e| format!("Failed to list shares: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed to list shares ({}): {}", status, text));
    }

    let shares: Vec<SupabaseShare> = resp
        .json()
        .map_err(|e| format!("Failed to parse shares: {}", e))?;

    // Merge with local records for path mapping
    let local_records = get_share_records(app);

    let items = shares
        .into_iter()
        .map(|s| {
            let local_path = local_records
                .iter()
                .find(|r| r.slug == s.slug)
                .map(|r| r.local_path.clone());

            CloudShareListItem {
                url: format!("{}/s/{}", PUBLIC_VIEWER_URL, s.slug),
                slug: s.slug,
                title: s.title.unwrap_or_else(|| "Untitled".to_string()),
                share_type: s.share_type,
                local_path,
                updated_at: s.updated_at.unwrap_or_default(),
            }
        })
        .collect();

    Ok(items)
}

#[tauri::command]
pub async fn cloud_remove(app: tauri::AppHandle, slug: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || cloud_remove_inner(&app, &slug))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn cloud_remove_inner(app: &tauri::AppHandle, slug: &str) -> Result<(), String> {
    let creds = ensure_api_key(app)?;
    let key_hash = hash_api_key(&creds.api_key);
    let client = supabase_client();

    // Find the share by slug + api_key_id
    let resp = client
        .get(&format!(
            "{}?slug=eq.{}&api_key_id=eq.{}",
            supabase_rest_url("shares"),
            slug,
            creds.api_key_id
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("x-api-key-hash", &key_hash)
        .send()
        .map_err(|e| format!("Failed to find share: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed to find share ({}): {}", status, text));
    }

    let shares: Vec<SupabaseShare> = resp
        .json()
        .map_err(|e| format!("Failed to parse share: {}", e))?;

    let share = shares
        .into_iter()
        .next()
        .ok_or_else(|| format!("Share '{}' not found", slug))?;

    // Get file paths from share_files to delete from storage
    #[derive(Deserialize)]
    struct ShareFile {
        storage_path: String,
    }

    let resp = client
        .get(&format!(
            "{}?share_id=eq.{}&select=storage_path",
            supabase_rest_url("share_files"),
            share.id
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("x-api-key-hash", &key_hash)
        .send()
        .map_err(|e| format!("Failed to get share files: {}", e))?;

    if resp.status().is_success() {
        if let Ok(files) = resp.json::<Vec<ShareFile>>() {
            // Delete storage files
            for file in &files {
                let _ = client
                    .delete(&storage_url(&file.storage_path))
                    .header("apikey", SUPABASE_ANON_KEY)
        
                    .send();
            }
        }
    }

    // Delete share record (cascades to share_files via DB foreign key)
    let resp = client
        .delete(&format!(
            "{}?id=eq.{}&api_key_id=eq.{}",
            supabase_rest_url("shares"),
            share.id,
            creds.api_key_id
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("x-api-key-hash", &key_hash)
        .send()
        .map_err(|e| format!("Failed to delete share: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().unwrap_or_default();
        return Err(format!("Failed to delete share ({}): {}", status, text));
    }

    // Remove local record
    remove_share_record(app, slug)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn create_temp_dir(prefix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lightsee_cloud_test_{}_{}", prefix, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    // ── hash_api_key ───────────────────────────────────────────────

    #[test]
    fn hash_api_key_consistent_sha256() {
        let hash = hash_api_key("test_key_123");
        // SHA-256 of "test_key_123" is a known value
        assert_eq!(hash.len(), 64); // 256 bits = 64 hex chars
        // Verify consistency
        assert_eq!(hash, hash_api_key("test_key_123"));
        // Verify known hash (SHA-256 of "test_key_123")
        assert_eq!(
            hash,
            "1f8e8c97805e4ad56c611029fbba4c04dab40bf05d18c46655696357705cc136"
        );
    }

    // ── generate_slug ──────────────────────────────────────────────

    #[test]
    fn generate_slug_length() {
        let slug = generate_slug();
        assert_eq!(slug.len(), 10);
    }

    #[test]
    fn generate_slug_unique() {
        let a = generate_slug();
        let b = generate_slug();
        assert_ne!(a, b);
    }

    // ── collect_markdown_files ──────────────────────────────────────

    #[test]
    fn collect_markdown_files_only_md() {
        let dir = create_temp_dir("collect_md");
        fs::write(dir.join("a.md"), "md").unwrap();
        fs::write(dir.join("b.markdown"), "markdown").unwrap();
        fs::write(dir.join("c.txt"), "txt").unwrap();
        fs::write(dir.join("d.rs"), "rs").unwrap();

        let files = collect_markdown_files(&dir);
        assert_eq!(files.len(), 2);
        let names: Vec<String> = files.iter().map(|p| p.file_name().unwrap().to_string_lossy().to_string()).collect();
        assert!(names.contains(&"a.md".to_string()));
        assert!(names.contains(&"b.markdown".to_string()));

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn collect_markdown_files_skips_hidden() {
        let dir = create_temp_dir("collect_hidden");
        fs::write(dir.join("visible.md"), "ok").unwrap();
        fs::write(dir.join(".hidden.md"), "hidden").unwrap();
        let hidden_dir = dir.join(".hidden_dir");
        fs::create_dir_all(&hidden_dir).unwrap();
        fs::write(hidden_dir.join("inside.md"), "inside").unwrap();

        let files = collect_markdown_files(&dir);
        assert_eq!(files.len(), 1);
        assert!(files[0].file_name().unwrap().to_string_lossy() == "visible.md");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn collect_markdown_files_max_files_limit() {
        let dir = create_temp_dir("collect_limit");
        for i in 0..=MAX_FILES {
            fs::write(dir.join(format!("file_{:04}.md", i)), "content").unwrap();
        }

        let files = collect_markdown_files(&dir);
        assert!(files.len() <= MAX_FILES, "got {} files, max is {}", files.len(), MAX_FILES);

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn collect_markdown_files_single_file_returns_empty() {
        // collect_markdown_files takes a dir; passing a single file returns empty
        // (single-file handling is done at the call site in cloud_expose_inner)
        let dir = create_temp_dir("collect_single");
        let file = dir.join("single.md");
        fs::write(&file, "content").unwrap();

        let files = collect_markdown_files(&file);
        assert!(files.is_empty());

        fs::remove_dir_all(&dir).unwrap();
    }

    // ── ascii_safe_segment ────────────────────────────────────────────

    #[test]
    fn ascii_safe_segment_ascii_passthrough() {
        assert_eq!(ascii_safe_segment("hello.md"), "hello.md");
        assert_eq!(ascii_safe_segment("README"), "README");
        assert_eq!(ascii_safe_segment("my-file_v2.markdown"), "my-file_v2.markdown");
    }

    #[test]
    fn ascii_safe_segment_non_ascii_hashed() {
        let result = ascii_safe_segment("한글파일.md");
        // Should be 16-char hash + .md extension
        assert!(result.ends_with(".md"), "expected .md extension, got: {}", result);
        assert_eq!(result.len(), 16 + 3); // 16 hex chars + ".md"
        assert!(result.is_ascii());
    }

    #[test]
    fn ascii_safe_segment_non_ascii_consistent() {
        let a = ascii_safe_segment("한글파일.md");
        let b = ascii_safe_segment("한글파일.md");
        assert_eq!(a, b, "same input should produce same output");
    }

    #[test]
    fn ascii_safe_segment_different_non_ascii_different_hash() {
        let a = ascii_safe_segment("파일1.md");
        let b = ascii_safe_segment("파일2.md");
        assert_ne!(a, b, "different inputs should produce different hashes");
    }

    #[test]
    fn ascii_safe_segment_non_ascii_no_extension() {
        let result = ascii_safe_segment("한글폴더");
        assert_eq!(result.len(), 16);
        assert!(result.is_ascii());
    }

    #[test]
    fn ascii_safe_segment_non_ascii_extension() {
        // If the extension itself is non-ASCII, it should be dropped
        let result = ascii_safe_segment("파일.한글");
        assert_eq!(result.len(), 16);
        assert!(result.is_ascii());
    }

    // ── collect_markdown_files recursive ──────────────────────────────

    #[test]
    fn collect_markdown_files_recursive_subdirs() {
        let dir = create_temp_dir("collect_recursive");
        fs::write(dir.join("top.md"), "top").unwrap();
        let sub = dir.join("sub");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("nested.md"), "nested").unwrap();
        let deep = sub.join("deep");
        fs::create_dir_all(&deep).unwrap();
        fs::write(deep.join("deep.md"), "deep").unwrap();

        let files = collect_markdown_files(&dir);
        assert_eq!(files.len(), 3);

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn collect_markdown_files_empty_dir() {
        let dir = create_temp_dir("collect_empty");
        let files = collect_markdown_files(&dir);
        assert!(files.is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    // ── hash_api_key edge cases ──────────────────────────────────────

    #[test]
    fn hash_api_key_empty_string() {
        let hash = hash_api_key("");
        assert_eq!(hash.len(), 64);
        // SHA-256 of empty string is a known value
        assert_eq!(hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }

    #[test]
    fn hash_api_key_different_inputs() {
        let h1 = hash_api_key("key1");
        let h2 = hash_api_key("key2");
        assert_ne!(h1, h2);
    }
}
