# Cloud Share & CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vercel+Supabase cloud sharing and Tauri CLI so users can expose local markdown files/folders to public URLs.

**Architecture:** Desktop app and CLI push markdown files to Supabase Storage via REST API, with metadata in Supabase DB. A Next.js app on Vercel serves as the read-only viewer. API keys are auto-generated on first use and stored locally via Tauri store.

**Tech Stack:** Tauri 2 (Rust) + React 19 (frontend) + Supabase (Storage + DB + Edge Functions) + Next.js App Router (viewer) + `tauri-plugin-cli` (CLI)

**Spec:** `docs/superpowers/specs/2026-03-30-cloud-share-cli-design.md`

---

## File Structure

### Supabase (new project: `lightsee-web/supabase/`)

```
lightsee-web/
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql        # DB tables + RLS policies
│   └── functions/
│       └── issue-api-key/
│           └── index.ts                   # API key generation edge function
├── src/app/
│   ├── layout.tsx                         # Root layout
│   ├── globals.css                        # Markdown rendering styles
│   ├── page.tsx                           # Landing/home page
│   └── s/[slug]/
│       ├── page.tsx                       # Share viewer (single file or folder index)
│       └── [...path]/
│           └── page.tsx                   # Folder sub-file viewer
├── src/lib/
│   ├── supabase.ts                        # Supabase client init
│   ├── markdown.ts                        # Marked + DOMPurify rendering (server-side)
│   ├── themes.ts                          # Theme definitions (shared with desktop)
│   └── types.ts                           # Shared TypeScript types
├── src/components/
│   ├── MarkdownViewer.tsx                 # Markdown rendering component
│   ├── DirectoryTree.tsx                  # Folder navigation sidebar
│   ├── TableOfContents.tsx                # TOC component
│   └── HtmlExportButton.tsx              # Self-contained HTML download
├── package.json
├── next.config.ts
└── tsconfig.json
```

### Desktop App (modify existing)

```
src-tauri/
├── src/
│   ├── lib.rs                             # Modify: add CLI plugin + cloud commands
│   ├── cloud.rs                           # NEW: Supabase upload/manage logic
│   └── share.rs                           # Existing: no changes
├── Cargo.toml                             # Modify: add reqwest, sha2, nanoid deps

src/
├── App.tsx                                # Modify: add cloud share state + UI entry
├── CloudSharePanel.tsx                    # NEW: Cloud share UI component
├── SharePanel.tsx                         # Existing: no changes
└── LeftSidebar.tsx                        # Modify: add cloud indicator on folders
```

---

## Task 1: Supabase Project Setup & DB Schema

**Files:**
- Create: `lightsee-web/supabase/migrations/001_initial_schema.sql`
- Create: `lightsee-web/package.json`

- [ ] **Step 1: Initialize lightsee-web project**

```bash
mkdir -p lightsee-web/supabase/migrations lightsee-web/supabase/functions
cd lightsee-web
npm init -y
```

- [ ] **Step 2: Write the migration SQL**

Create `lightsee-web/supabase/migrations/001_initial_schema.sql`:

```sql
-- API Keys table
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Shares table
CREATE TABLE shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('file', 'folder')),
  theme text NOT NULL DEFAULT 'light',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_shares_slug ON shares(slug);
CREATE INDEX idx_shares_api_key_id ON shares(api_key_id);

-- Share files table
CREATE TABLE share_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  path text NOT NULL,
  storage_path text NOT NULL,
  size_bytes int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_share_files_share_id ON share_files(share_id);

-- RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_files ENABLE ROW LEVEL SECURITY;

-- Public read for shares and share_files (viewer needs to read)
CREATE POLICY "Public read shares" ON shares FOR SELECT USING (true);
CREATE POLICY "Public read share_files" ON share_files FOR SELECT USING (true);

-- API keys: insert only (via edge function with service role)
-- No direct client access to api_keys table

-- Storage bucket (run manually in Supabase dashboard or via CLI)
-- CREATE BUCKET lightsee-files WITH public = true;
```

- [ ] **Step 3: Apply migration to Supabase**

```bash
# Link to Supabase project (one-time setup)
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

Create the `lightsee-files` storage bucket in Supabase dashboard with public read access.

- [ ] **Step 4: Commit**

```bash
git add lightsee-web/
git commit -m "feat: add Supabase schema for cloud sharing"
```

---

## Task 2: Supabase Edge Function — API Key Issuance

**Files:**
- Create: `lightsee-web/supabase/functions/issue-api-key/index.ts`

- [ ] **Step 1: Write the edge function**

Create `lightsee-web/supabase/functions/issue-api-key/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Generate a random API key
  const rawKey = crypto.randomUUID() + "-" + crypto.randomUUID();

  // Hash it with SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Store the hash
  const { data: row, error } = await supabase
    .from("api_keys")
    .insert({ key_hash: keyHash })
    .select("id")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to create key" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ api_key: rawKey, api_key_id: row.id }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
```

- [ ] **Step 2: Deploy the edge function**

```bash
cd lightsee-web
npx supabase functions deploy issue-api-key
```

- [ ] **Step 3: Test the function**

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/issue-api-key
# Expected: {"api_key":"<uuid>-<uuid>","api_key_id":"<uuid>"}
```

- [ ] **Step 4: Commit**

```bash
git add lightsee-web/supabase/functions/
git commit -m "feat: add API key issuance edge function"
```

---

## Task 3: Rust Cloud Module — API Key & Upload Logic

**Files:**
- Create: `src-tauri/src/cloud.rs`
- Modify: `src-tauri/Cargo.toml` (add deps)
- Modify: `src-tauri/src/lib.rs` (register module + commands)

- [ ] **Step 1: Add Rust dependencies**

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
sha2 = "0.10"
nanoid = "0.4"
```

- [ ] **Step 2: Write the cloud module**

Create `src-tauri/src/cloud.rs`:

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;
use tauri_plugin_store::StoreExt;

const SUPABASE_URL: &str = "https://<PROJECT_REF>.supabase.co";
const SUPABASE_ANON_KEY: &str = "<ANON_KEY>";
const EDGE_FUNCTION_URL: &str = "https://<PROJECT_REF>.supabase.co/functions/v1/issue-api-key";
const STORAGE_BUCKET: &str = "lightsee-files";
const PUBLIC_VIEWER_URL: &str = "https://lightsee.vercel.app";

#[derive(Clone, Serialize, Deserialize)]
pub struct CloudCredentials {
    pub api_key: String,
    pub api_key_id: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CloudShareRecord {
    pub local_path: String,
    pub share_id: String,
    pub slug: String,
    #[serde(rename = "type")]
    pub share_type: String,
}

#[derive(Serialize)]
pub struct CloudShareResult {
    pub url: String,
    pub slug: String,
    pub share_id: String,
    pub files_uploaded: usize,
}

#[derive(Serialize)]
pub struct CloudShareListItem {
    pub slug: String,
    pub title: String,
    #[serde(rename = "type")]
    pub share_type: String,
    pub local_path: String,
    pub url: String,
    pub updated_at: String,
}

fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn generate_slug() -> String {
    nanoid::nanoid!(10, &nanoid::alphabet::SAFE)
}

fn collect_markdown_files(dir: &Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    if dir.is_file() {
        if crate::is_markdown_ext(dir) {
            files.push(dir.to_path_buf());
        }
        return files;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.file_name().map(|n| n.to_string_lossy().starts_with('.')).unwrap_or(false) {
                continue;
            }
            if path.is_dir() {
                files.extend(collect_markdown_files(&path));
            } else if crate::is_markdown_ext(&path) {
                files.push(path);
            }
        }
    }
    files
}

async fn ensure_api_key(app: &tauri::AppHandle) -> Result<CloudCredentials, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    if let Some(creds) = store.get("cloud_credentials") {
        let creds: CloudCredentials =
            serde_json::from_value(creds).map_err(|e| e.to_string())?;
        return Ok(creds);
    }

    // Request new key from edge function
    let client = Client::new();
    let resp = client
        .post(EDGE_FUNCTION_URL)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Failed to issue API key: HTTP {}", resp.status()));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let creds = CloudCredentials {
        api_key: body["api_key"].as_str().ok_or("Missing api_key")?.to_string(),
        api_key_id: body["api_key_id"].as_str().ok_or("Missing api_key_id")?.to_string(),
    };

    store.set(
        "cloud_credentials",
        serde_json::to_value(&creds).unwrap(),
    );
    store.save().map_err(|e| e.to_string())?;

    Ok(creds)
}

fn find_existing_share(app: &tauri::AppHandle, local_path: &str) -> Option<CloudShareRecord> {
    let store = app.store("settings.json").ok()?;
    let shares = store.get("cloud_shares")?;
    let shares: Vec<CloudShareRecord> = serde_json::from_value(shares).ok()?;
    shares.into_iter().find(|s| s.local_path == local_path)
}

fn save_share_record(app: &tauri::AppHandle, record: CloudShareRecord) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let mut shares: Vec<CloudShareRecord> = store
        .get("cloud_shares")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    if let Some(existing) = shares.iter_mut().find(|s| s.local_path == record.local_path) {
        *existing = record;
    } else {
        shares.push(record);
    }

    store.set("cloud_shares", serde_json::to_value(&shares).unwrap());
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

fn remove_share_record(app: &tauri::AppHandle, slug: &str) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let mut shares: Vec<CloudShareRecord> = store
        .get("cloud_shares")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    shares.retain(|s| s.slug != slug);
    store.set("cloud_shares", serde_json::to_value(&shares).unwrap());
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn cloud_expose(
    app: tauri::AppHandle,
    path: String,
    theme: String,
) -> Result<CloudShareResult, String> {
    let local_path = crate::normalize_path(std::path::Path::new(&path));
    let creds = ensure_api_key(&app).await?;
    let client = Client::new();

    let src_path = std::path::Path::new(&path);
    let is_file = src_path.is_file();
    let share_type = if is_file { "file" } else { "folder" };
    let title = src_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    // Collect files
    let files = collect_markdown_files(src_path);
    if files.is_empty() {
        return Err("No markdown files found".into());
    }
    if files.len() > 200 {
        return Err(format!("Too many files ({}, max 200)", files.len()));
    }

    // Check for existing share (re-push)
    let existing = find_existing_share(&app, &local_path);
    let (share_id, slug) = if let Some(ref existing) = existing {
        (existing.share_id.clone(), existing.slug.clone())
    } else {
        let slug = generate_slug();
        // Create share record in DB
        let resp = client
            .post(format!("{}/rest/v1/shares", SUPABASE_URL))
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
            .header("Prefer", "return=representation")
            .json(&serde_json::json!({
                "api_key_id": creds.api_key_id,
                "slug": slug,
                "title": title,
                "type": share_type,
                "theme": theme,
            }))
            .send()
            .await
            .map_err(|e| format!("Failed to create share: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Failed to create share: {}", body));
        }

        let rows: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
        let share_id = rows[0]["id"].as_str().ok_or("Missing share id")?.to_string();
        (share_id, slug)
    };

    // If re-push, update theme and updated_at
    if existing.is_some() {
        client
            .patch(format!("{}/rest/v1/shares?id=eq.{}", SUPABASE_URL, share_id))
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
            .json(&serde_json::json!({
                "theme": theme,
                "updated_at": "now()",
            }))
            .send()
            .await
            .ok();

        // Delete old share_files records for re-sync
        client
            .delete(format!("{}/rest/v1/share_files?share_id=eq.{}", SUPABASE_URL, share_id))
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
            .send()
            .await
            .ok();
    }

    // Upload files to storage + insert share_files records
    let base = if is_file {
        src_path.parent().unwrap_or(src_path)
    } else {
        src_path
    };

    let mut uploaded = 0;
    for file_path in &files {
        let content = std::fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;

        let size = content.len();
        if size > 5 * 1024 * 1024 {
            return Err(format!(
                "File too large: {} ({} bytes, max 5MB)",
                file_path.display(),
                size
            ));
        }

        let relative = if is_file {
            file_path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .to_string()
        } else {
            file_path
                .strip_prefix(base)
                .unwrap_or(file_path)
                .to_string_lossy()
                .to_string()
        };

        let storage_path = format!("{}/{}/{}", creds.api_key_id, share_id, relative);

        // Upload to Supabase Storage
        let upload_url = format!(
            "{}/storage/v1/object/{}/{}",
            SUPABASE_URL, STORAGE_BUCKET, storage_path
        );

        let resp = client
            .post(&upload_url)
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
            .header("Content-Type", "text/markdown")
            .header("x-upsert", "true")
            .body(content)
            .send()
            .await
            .map_err(|e| format!("Upload failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Upload failed for {}: {}", relative, body));
        }

        // Insert share_files record
        client
            .post(format!("{}/rest/v1/share_files", SUPABASE_URL))
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
            .json(&serde_json::json!({
                "share_id": share_id,
                "path": relative,
                "storage_path": storage_path,
                "size_bytes": size,
            }))
            .send()
            .await
            .map_err(|e| format!("Failed to record file: {}", e))?;

        uploaded += 1;
    }

    // Save local record
    save_share_record(
        &app,
        CloudShareRecord {
            local_path,
            share_id: share_id.clone(),
            slug: slug.clone(),
            share_type: share_type.to_string(),
        },
    )?;

    Ok(CloudShareResult {
        url: format!("{}/s/{}", PUBLIC_VIEWER_URL, slug),
        slug,
        share_id,
        files_uploaded: uploaded,
    })
}

#[tauri::command]
pub async fn cloud_list(app: tauri::AppHandle) -> Result<Vec<CloudShareListItem>, String> {
    let creds = ensure_api_key(&app).await?;
    let client = Client::new();

    let resp = client
        .get(format!(
            "{}/rest/v1/shares?api_key_id=eq.{}&select=*&order=updated_at.desc",
            SUPABASE_URL, creds.api_key_id
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .send()
        .await
        .map_err(|e| format!("Failed to list shares: {}", e))?;

    let rows: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

    // Load local records for path mapping
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let local_shares: Vec<CloudShareRecord> = store
        .get("cloud_shares")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let items = rows
        .iter()
        .map(|r| {
            let slug = r["slug"].as_str().unwrap_or("").to_string();
            let local_path = local_shares
                .iter()
                .find(|s| s.slug == slug)
                .map(|s| s.local_path.clone())
                .unwrap_or_default();

            CloudShareListItem {
                slug: slug.clone(),
                title: r["title"].as_str().unwrap_or("").to_string(),
                share_type: r["type"].as_str().unwrap_or("").to_string(),
                local_path,
                url: format!("{}/s/{}", PUBLIC_VIEWER_URL, slug),
                updated_at: r["updated_at"].as_str().unwrap_or("").to_string(),
            }
        })
        .collect();

    Ok(items)
}

#[tauri::command]
pub async fn cloud_remove(app: tauri::AppHandle, slug: String) -> Result<(), String> {
    let creds = ensure_api_key(&app).await?;
    let client = Client::new();

    // Get share id
    let resp = client
        .get(format!(
            "{}/rest/v1/shares?slug=eq.{}&api_key_id=eq.{}&select=id",
            SUPABASE_URL, slug, creds.api_key_id
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let rows: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
    let share_id = rows
        .first()
        .and_then(|r| r["id"].as_str())
        .ok_or("Share not found")?
        .to_string();

    // Delete storage files
    let files_resp = client
        .get(format!(
            "{}/rest/v1/share_files?share_id=eq.{}&select=storage_path",
            SUPABASE_URL, share_id
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let file_rows: Vec<serde_json::Value> = files_resp.json().await.map_err(|e| e.to_string())?;
    for row in &file_rows {
        if let Some(storage_path) = row["storage_path"].as_str() {
            client
                .delete(format!(
                    "{}/storage/v1/object/{}/{}",
                    SUPABASE_URL, STORAGE_BUCKET, storage_path
                ))
                .header("apikey", SUPABASE_ANON_KEY)
                .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
                .send()
                .await
                .ok();
        }
    }

    // Delete share (cascades to share_files)
    client
        .delete(format!(
            "{}/rest/v1/shares?id=eq.{}",
            SUPABASE_URL, share_id
        ))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .send()
        .await
        .map_err(|e| format!("Failed to delete share: {}", e))?;

    // Remove local record
    remove_share_record(&app, &slug)?;

    Ok(())
}
```

- [ ] **Step 3: Register cloud module and commands in lib.rs**

In `src-tauri/src/lib.rs`, add at the top:

```rust
mod cloud;
```

And add to the `invoke_handler` macro:

```rust
.invoke_handler(tauri::generate_handler![
    get_pending_files, read_file, list_markdown_files,
    start_sharing, stop_sharing, update_shared_content, get_share_status,
    cloud::cloud_expose, cloud::cloud_list, cloud::cloud_remove
])
```

- [ ] **Step 4: Build and verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/
git commit -m "feat: add Rust cloud module for Supabase uploads"
```

---

## Task 4: Tauri CLI Plugin Integration

**Files:**
- Modify: `src-tauri/Cargo.toml` (add tauri-plugin-cli)
- Modify: `src-tauri/src/lib.rs` (add CLI handling)
- Modify: `src-tauri/tauri.conf.json` (add CLI config)

- [ ] **Step 1: Add tauri-plugin-cli dependency**

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
tauri-plugin-cli = "2"
```

- [ ] **Step 2: Add CLI configuration to tauri.conf.json**

Add `"cli"` section inside `"plugins"` in `src-tauri/tauri.conf.json`:

```json
"cli": {
  "description": "Lightsee - Markdown viewer and cloud sharing tool",
  "args": [],
  "subcommands": {
    "expose": {
      "description": "Expose a file or folder to the cloud",
      "args": [
        {
          "name": "path",
          "description": "Path to markdown file or folder",
          "index": 1,
          "required": true
        }
      ]
    },
    "list": {
      "description": "List cloud shares",
      "args": []
    },
    "remove": {
      "description": "Remove a cloud share",
      "args": [
        {
          "name": "slug",
          "description": "Share slug to remove",
          "index": 1,
          "required": true
        }
      ]
    }
  }
}
```

- [ ] **Step 3: Add CLI handling in lib.rs**

Modify `src-tauri/src/lib.rs` — add CLI plugin and handle subcommands in `run()`.

After `.plugin(tauri_plugin_process::init())`, add:

```rust
.plugin(tauri_plugin_cli::init())
```

Before the existing `app.run(...)`, add CLI dispatch logic:

```rust
// Handle CLI subcommands
if let Ok(matches) = app.cli().matches() {
    if let Some((subcmd_name, subcmd)) = matches.subcommand {
        let app_handle = app.handle().clone();
        match subcmd_name.as_str() {
            "expose" => {
                let path = subcmd.args.get("path")
                    .and_then(|a| a.value.as_str())
                    .map(|s| s.to_string())
                    .expect("path argument required");

                let path = std::path::Path::new(&path)
                    .canonicalize()
                    .unwrap_or_else(|_| std::path::PathBuf::from(&path))
                    .to_string_lossy()
                    .to_string();

                tauri::async_runtime::spawn(async move {
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
                return; // Don't open the GUI window
            }
            "list" => {
                tauri::async_runtime::spawn(async move {
                    match cloud::cloud_list(app_handle).await {
                        Ok(items) => {
                            if items.is_empty() {
                                println!("No cloud shares.");
                            } else {
                                for item in items {
                                    println!("{}\t{}\t{}\t{}", item.slug, item.share_type, item.local_path, item.updated_at);
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
                return;
            }
            "remove" => {
                let slug = subcmd.args.get("slug")
                    .and_then(|a| a.value.as_str())
                    .map(|s| s.to_string())
                    .expect("slug argument required");

                tauri::async_runtime::spawn(async move {
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
                return;
            }
            _ => {}
        }
    }
}
```

- [ ] **Step 4: Build and verify**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/
git commit -m "feat: add Tauri CLI plugin for expose/list/remove commands"
```

---

## Task 5: Desktop App — CloudSharePanel Component

**Files:**
- Create: `src/CloudSharePanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create CloudSharePanel component**

Create `src/CloudSharePanel.tsx`:

```tsx
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CloudShareResult {
  url: string;
  slug: string;
  share_id: string;
  files_uploaded: number;
}

interface CloudSharePanelProps {
  theme: {
    bg: string;
    text: string;
    heading: string;
    link: string;
    codeBg: string;
    border: string;
    blockquoteBorder: string;
    blockquoteText: string;
  };
  activeFilePath: string | null;
  themeName: string;
}

export default function CloudSharePanel({ theme, activeFilePath, themeName }: CloudSharePanelProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CloudShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const expose = useCallback(async () => {
    if (!activeFilePath) return;
    setUploading(true);
    setError(null);
    try {
      const res = await invoke<CloudShareResult>("cloud_expose", {
        path: activeFilePath,
        theme: themeName,
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }, [activeFilePath, themeName]);

  const copyUrl = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const remove = useCallback(async () => {
    if (!result) return;
    try {
      await invoke("cloud_remove", { slug: result.slug });
      setResult(null);
    } catch (e) {
      setError(String(e));
    }
  }, [result]);

  return (
    <div
      className="share-panel"
      style={{
        backgroundColor: theme.codeBg,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      {error && (
        <div style={{ color: "#e55", fontSize: "12px", padding: "4px 12px" }}>
          {error}
        </div>
      )}

      {!result ? (
        <div className="share-row">
          <button
            className="btn"
            style={{ color: theme.text, borderColor: theme.border }}
            onClick={expose}
            disabled={!activeFilePath || uploading}
          >
            {uploading ? "Uploading..." : "Cloud Share"}
          </button>
          <span style={{ fontSize: "12px", color: theme.blockquoteText }}>
            Publish to cloud for anyone to view
          </span>
        </div>
      ) : (
        <>
          <div className="share-row">
            <button
              className="btn btn-sm"
              style={{ color: theme.text, borderColor: theme.border }}
              onClick={copyUrl}
            >
              {copied ? "Copied!" : "Copy URL"}
            </button>
            <button
              className="btn btn-sm"
              style={{ color: theme.text, borderColor: theme.border }}
              onClick={expose}
              disabled={uploading}
            >
              {uploading ? "Updating..." : "Update"}
            </button>
            <button
              className="btn btn-sm"
              style={{ color: "#e55", borderColor: theme.border }}
              onClick={remove}
            >
              Remove
            </button>
            <span style={{ fontSize: "12px", color: theme.blockquoteText }}>
              {result.files_uploaded} file{result.files_uploaded !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="share-details">
            <div className="share-url" style={{ color: theme.link }}>
              {result.url}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into App.tsx**

Add import at top of `src/App.tsx`:

```tsx
import CloudSharePanel from "./CloudSharePanel";
```

Add state for cloud share panel visibility (alongside `showSharePanel` state):

```tsx
const [showCloudPanel, setShowCloudPanel] = useState(false);
```

Add a "Cloud" button in the toolbar-right section, after the existing Share button:

```tsx
<button
  className="btn"
  style={{ color: currentTheme.text, borderColor: currentTheme.border }}
  onClick={() => setShowCloudPanel(!showCloudPanel)}
>
  Cloud
</button>
```

Render the CloudSharePanel below the SharePanel section:

```tsx
{showCloudPanel && (
  <CloudSharePanel
    theme={currentTheme}
    activeFilePath={activeTab?.filePath || null}
    themeName={theme}
  />
)}
```

- [ ] **Step 3: Build and verify frontend compiles**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/CloudSharePanel.tsx src/App.tsx
git commit -m "feat: add CloudSharePanel UI component"
```

---

## Task 6: Left Sidebar — Cloud Indicator

**Files:**
- Modify: `src/LeftSidebar.tsx`
- Modify: `src/App.tsx` (pass cloud shares data)

- [ ] **Step 1: Read current LeftSidebar.tsx to understand props**

Read `src/LeftSidebar.tsx` to understand the current component interface.

- [ ] **Step 2: Add cloudPaths prop to LeftSidebar**

Add a new prop `cloudPaths` (array of local paths that are cloud-shared) to the LeftSidebar props interface:

```tsx
interface LeftSidebarProps {
  // ...existing props
  cloudPaths: string[];
}
```

In the favorite folder rendering, add a cloud indicator when the folder path is in `cloudPaths`:

```tsx
{cloudPaths.includes(folder) && (
  <span style={{ marginLeft: "4px", opacity: 0.6 }} title="Cloud shared">☁</span>
)}
```

- [ ] **Step 3: Pass cloudPaths from App.tsx**

In `App.tsx`, derive cloudPaths from the cloud_shares setting:

```tsx
const [cloudShares, setCloudShares] = useState<Array<{ local_path: string; slug: string }>>([]);
```

In the settings load useEffect, add:

```tsx
const savedCloudShares = await store.get<Array<{ local_path: string; slug: string }>>("cloud_shares");
if (savedCloudShares) setCloudShares(savedCloudShares);
```

Pass to LeftSidebar:

```tsx
<LeftSidebar
  // ...existing props
  cloudPaths={cloudShares.map(s => s.local_path)}
/>
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/LeftSidebar.tsx src/App.tsx
git commit -m "feat: add cloud share indicator to favorite folders"
```

---

## Task 7: Next.js Viewer — Project Setup

**Files:**
- Modify: `lightsee-web/package.json`
- Create: `lightsee-web/next.config.ts`
- Create: `lightsee-web/tsconfig.json`
- Create: `lightsee-web/src/lib/supabase.ts`
- Create: `lightsee-web/src/lib/types.ts`
- Create: `lightsee-web/src/lib/themes.ts`
- Create: `lightsee-web/src/lib/markdown.ts`
- Create: `lightsee-web/src/app/layout.tsx`

- [ ] **Step 1: Install Next.js dependencies**

```bash
cd lightsee-web
npm install next@latest react@latest react-dom@latest typescript @types/react @types/react-dom
npm install @supabase/supabase-js marked dompurify @types/dompurify jsdom @types/jsdom
```

Update `lightsee-web/package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `lightsee-web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

Create `lightsee-web/next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 4: Create shared library files**

Create `lightsee-web/src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

Create `lightsee-web/src/lib/types.ts`:

```typescript
export interface Share {
  id: string;
  slug: string;
  title: string;
  type: "file" | "folder";
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface ShareFile {
  id: string;
  share_id: string;
  path: string;
  storage_path: string;
  size_bytes: number;
}

export interface ThemeColors {
  bg: string;
  text: string;
  heading: string;
  link: string;
  codeBg: string;
  border: string;
  blockquoteBorder: string;
  blockquoteText: string;
}
```

Create `lightsee-web/src/lib/themes.ts` — full theme map matching desktop app's `themes` object (all 17 themes with their `ThemeColors` values). See spec Task 8 Step 4 in the first draft for the complete content.

Create `lightsee-web/src/lib/markdown.ts`:

```typescript
import { marked } from "marked";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const purify = DOMPurify(window as unknown as Window);

export function renderMarkdown(raw: string): { html: string; headings: Array<{ id: string; text: string; level: number }> } {
  const parsed = marked.parse(raw, { async: false }) as string;
  const sanitized = purify.sanitize(parsed);
  const wrapped = sanitized.replace(/<table([\s\S]*?<\/table>)/g, '<div class="table-wrapper"><table$1</div>');

  const headings: Array<{ id: string; text: string; level: number }> = [];
  const slugCounts = new Map<string, number>();

  const html = wrapped.replace(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi, (_match, tag, attrs, content) => {
    const text = content.replace(/<[^>]*>/g, "").trim();
    let slug = text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
    if (!slug) slug = "heading";
    const count = slugCounts.get(slug) || 0;
    slugCounts.set(slug, count + 1);
    const finalSlug = count > 0 ? `${slug}-${count}` : slug;
    const level = parseInt(tag[1], 10);
    headings.push({ id: finalSlug, text, level });
    return `<${tag}${attrs} id="${finalSlug}">${content}</${tag}>`;
  });

  return { html, headings };
}
```

- [ ] **Step 5: Create root layout**

Create `lightsee-web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lightsee",
  description: "Markdown viewer and sharing platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Copy markdown styles**

Create `lightsee-web/src/app/globals.css` — extract the `.markdown-body` styles from the desktop app's `src/App.css` for consistent rendering.

- [ ] **Step 7: Build and verify**

```bash
cd lightsee-web && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add lightsee-web/
git commit -m "feat: initialize Next.js viewer project with shared libs"
```

---

## Task 8: Next.js Viewer — Components & Pages

**Files:**
- Create: `lightsee-web/src/components/MarkdownViewer.tsx`
- Create: `lightsee-web/src/components/TableOfContents.tsx`
- Create: `lightsee-web/src/components/DirectoryTree.tsx`
- Create: `lightsee-web/src/components/HtmlExportButton.tsx`
- Create: `lightsee-web/src/app/s/[slug]/page.tsx`
- Create: `lightsee-web/src/app/s/[slug]/[...path]/page.tsx`
- Create: `lightsee-web/src/app/page.tsx`

- [ ] **Step 1: Create MarkdownViewer component**

Create `lightsee-web/src/components/MarkdownViewer.tsx`:

```tsx
"use client";

import type { ThemeColors } from "@/lib/types";

interface MarkdownViewerProps {
  html: string;
  theme: ThemeColors;
  fontSize?: number;
}

// Content is sanitized with DOMPurify in renderMarkdown() before reaching this component
export default function MarkdownViewer({ html, theme, fontSize = 16 }: MarkdownViewerProps) {
  return (
    <div
      className="markdown-body"
      style={{
        fontSize: `${fontSize}px`,
        color: theme.text,
        backgroundColor: theme.bg,
        lineHeight: 1.7,
        padding: "32px 48px",
        maxWidth: "900px",
        margin: "0 auto",
        ["--heading-color" as string]: theme.heading,
        ["--link-color" as string]: theme.link,
        ["--code-bg" as string]: theme.codeBg,
        ["--border-color" as string]: theme.border,
        ["--blockquote-border" as string]: theme.blockquoteBorder,
        ["--blockquote-text" as string]: theme.blockquoteText,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 2: Create TableOfContents component**

Create `lightsee-web/src/components/TableOfContents.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ThemeColors } from "@/lib/types";

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings: Heading[];
  theme: ThemeColors;
}

export default function TableOfContents({ headings, theme }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (headings.length === 0) return null;

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <nav
      style={{
        position: "sticky",
        top: "20px",
        maxHeight: "calc(100vh - 80px)",
        overflowY: "auto",
        padding: "12px 16px",
        fontSize: "13px",
        borderLeft: `2px solid ${theme.border}`,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "8px", color: theme.heading }}>
        Contents
      </div>
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          onClick={() => setActiveId(h.id)}
          style={{
            display: "block",
            padding: "3px 0",
            paddingLeft: `${(h.level - minLevel) * 14}px`,
            color: activeId === h.id ? theme.link : theme.blockquoteText,
            textDecoration: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Create DirectoryTree component**

Create `lightsee-web/src/components/DirectoryTree.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ThemeColors } from "@/lib/types";

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

interface DirectoryTreeProps {
  files: Array<{ path: string }>;
  currentPath: string;
  slug: string;
  theme: ThemeColors;
}

function buildTree(files: Array<{ path: string }>): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const existing = current.find((n) => n.name === name);

      if (existing) {
        current = existing.children;
      } else {
        const node: TreeNode = {
          name,
          path: parts.slice(0, i + 1).join("/"),
          isDir: !isLast,
          children: [],
        };
        current.push(node);
        current = node.children;
      }
    }
  }

  return root;
}

function TreeItem({
  node,
  slug,
  currentPath,
  theme,
  depth,
}: {
  node: TreeNode;
  slug: string;
  currentPath: string;
  theme: ThemeColors;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const isActive = node.path === currentPath;

  if (node.isDir) {
    return (
      <div>
        <div
          style={{
            padding: "3px 8px",
            paddingLeft: `${8 + depth * 14}px`,
            cursor: "pointer",
            color: theme.blockquoteText,
            fontSize: "13px",
          }}
          onClick={() => setOpen(!open)}
        >
          {open ? "▼" : "▶"} {node.name}
        </div>
        {open && node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            slug={slug}
            currentPath={currentPath}
            theme={theme}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  return (
    <a
      href={`/s/${slug}/${node.path}`}
      style={{
        display: "block",
        padding: "3px 8px",
        paddingLeft: `${8 + depth * 14}px`,
        color: isActive ? theme.link : theme.text,
        textDecoration: "none",
        fontSize: "13px",
        backgroundColor: isActive ? theme.codeBg : "transparent",
      }}
    >
      {node.name}
    </a>
  );
}

export default function DirectoryTree({ files, currentPath, slug, theme }: DirectoryTreeProps) {
  const tree = buildTree(files);

  return (
    <nav
      style={{
        width: "220px",
        minWidth: "220px",
        borderRight: `1px solid ${theme.border}`,
        padding: "12px 0",
        overflowY: "auto",
        height: "100%",
      }}
    >
      {tree.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          slug={slug}
          currentPath={currentPath}
          theme={theme}
          depth={0}
        />
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Create HtmlExportButton component**

Create `lightsee-web/src/components/HtmlExportButton.tsx`:

```tsx
"use client";

import type { ThemeColors } from "@/lib/types";

interface HtmlExportButtonProps {
  html: string;
  title: string;
  theme: ThemeColors;
}

// html prop contains DOMPurify-sanitized content from renderMarkdown()
export default function HtmlExportButton({ html, title, theme }: HtmlExportButtonProps) {
  const handleExport = () => {
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: ${theme.bg};
    color: ${theme.text};
    line-height: 1.7;
    max-width: 900px;
    margin: 0 auto;
    padding: 32px 48px;
  }
  h1, h2, h3, h4, h5, h6 { color: ${theme.heading}; }
  a { color: ${theme.link}; }
  code { background: ${theme.codeBg}; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  pre { background: ${theme.codeBg}; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid ${theme.blockquoteBorder}; color: ${theme.blockquoteText}; margin: 0; padding: 8px 16px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid ${theme.border}; padding: 8px 12px; }
  hr { border: none; border-top: 1px solid ${theme.border}; }
  img { max-width: 100%; }
</style>
</head>
<body>${html}</body>
</html>`;

    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\.[^.]+$/, "")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      style={{
        padding: "6px 12px",
        fontSize: "13px",
        cursor: "pointer",
        background: "transparent",
        color: theme.blockquoteText,
        border: `1px solid ${theme.border}`,
        borderRadius: "4px",
      }}
    >
      HTML Export
    </button>
  );
}
```

- [ ] **Step 5: Create share page (slug root)**

Create `lightsee-web/src/app/s/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { renderMarkdown } from "@/lib/markdown";
import { themes } from "@/lib/themes";
import type { Share, ShareFile, ThemeColors } from "@/lib/types";
import MarkdownViewer from "@/components/MarkdownViewer";
import TableOfContents from "@/components/TableOfContents";
import DirectoryTree from "@/components/DirectoryTree";
import HtmlExportButton from "@/components/HtmlExportButton";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: share } = await supabase
    .from("shares")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!share) notFound();

  const typedShare = share as Share;
  const theme: ThemeColors = themes[typedShare.theme] || themes.light;

  const { data: files } = await supabase
    .from("share_files")
    .select("*")
    .eq("share_id", typedShare.id)
    .order("path");

  const typedFiles = (files || []) as ShareFile[];
  if (typedFiles.length === 0) notFound();

  const firstFile = typedFiles[0];
  const { data: fileData } = await supabase.storage
    .from("lightsee-files")
    .download(firstFile.storage_path);

  const markdown = fileData ? await fileData.text() : "";
  const { html, headings } = renderMarkdown(markdown);

  const isFolder = typedShare.type === "folder";

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          borderBottom: `1px solid ${theme.border}`,
          color: theme.text,
          fontSize: "14px",
        }}
      >
        <span style={{ fontWeight: 600 }}>
          {isFolder ? "📁" : "📄"} {typedShare.title}
        </span>
        <HtmlExportButton html={html} title={firstFile.path} theme={theme} />
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        {isFolder && (
          <DirectoryTree
            files={typedFiles}
            currentPath={firstFile.path}
            slug={slug}
            theme={theme}
          />
        )}

        <main style={{ flex: 1, overflow: "auto" }}>
          <MarkdownViewer html={html} theme={theme} />
        </main>

        {headings.length > 0 && (
          <div style={{ width: "220px", minWidth: "220px" }}>
            <TableOfContents headings={headings} theme={theme} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create folder sub-path page**

Create `lightsee-web/src/app/s/[slug]/[...path]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { renderMarkdown } from "@/lib/markdown";
import { themes } from "@/lib/themes";
import type { Share, ShareFile, ThemeColors } from "@/lib/types";
import MarkdownViewer from "@/components/MarkdownViewer";
import TableOfContents from "@/components/TableOfContents";
import DirectoryTree from "@/components/DirectoryTree";
import HtmlExportButton from "@/components/HtmlExportButton";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default async function ShareFilePage({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>;
}) {
  const { slug, path } = await params;
  const filePath = path.join("/");

  const { data: share } = await supabase
    .from("shares")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!share) notFound();

  const typedShare = share as Share;
  const theme: ThemeColors = themes[typedShare.theme] || themes.light;

  const { data: files } = await supabase
    .from("share_files")
    .select("*")
    .eq("share_id", typedShare.id)
    .order("path");

  const typedFiles = (files || []) as ShareFile[];

  const targetFile = typedFiles.find((f) => f.path === filePath);
  if (!targetFile) notFound();

  const { data: fileData } = await supabase.storage
    .from("lightsee-files")
    .download(targetFile.storage_path);

  const markdown = fileData ? await fileData.text() : "";
  const { html, headings } = renderMarkdown(markdown);

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          borderBottom: `1px solid ${theme.border}`,
          color: theme.text,
          fontSize: "14px",
        }}
      >
        <span style={{ fontWeight: 600 }}>📁 {typedShare.title} / {filePath}</span>
        <HtmlExportButton html={html} title={targetFile.path} theme={theme} />
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        <DirectoryTree
          files={typedFiles}
          currentPath={filePath}
          slug={slug}
          theme={theme}
        />

        <main style={{ flex: 1, overflow: "auto" }}>
          <MarkdownViewer html={html} theme={theme} />
        </main>

        {headings.length > 0 && (
          <div style={{ width: "220px", minWidth: "220px" }}>
            <TableOfContents headings={headings} theme={theme} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create landing page**

Create `lightsee-web/src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "#1e1e1e",
        color: "#d4d4d4",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "48px", marginBottom: "16px" }}>Lightsee</h1>
        <p style={{ fontSize: "18px", opacity: 0.7 }}>Markdown viewer and sharing platform</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Build and verify**

```bash
cd lightsee-web && npm run build
```

- [ ] **Step 9: Commit**

```bash
git add lightsee-web/
git commit -m "feat: add Next.js viewer pages with directory tree, TOC, and HTML export"
```

---

## Task 9: Deployment & Wiring

**Files:**
- Create: `lightsee-web/.env.local.example`
- Modify: `src-tauri/src/cloud.rs` (set actual URLs)

- [ ] **Step 1: Create environment variable example**

Create `lightsee-web/.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

- [ ] **Step 2: Deploy to Vercel**

```bash
cd lightsee-web
npx vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- [ ] **Step 3: Update Rust cloud module with actual URLs**

Update the constants in `src-tauri/src/cloud.rs`:
- `SUPABASE_URL` — actual Supabase project URL
- `SUPABASE_ANON_KEY` — actual anon key
- `EDGE_FUNCTION_URL` — actual edge function URL
- `PUBLIC_VIEWER_URL` — actual Vercel deployment URL

- [ ] **Step 4: Commit**

```bash
git add lightsee-web/.env.local.example src-tauri/src/cloud.rs
git commit -m "chore: add env example and update deployment URLs"
```

---

## Task 10: End-to-End Verification

- [ ] **Step 1: Test API key auto-generation**

```bash
lightsee expose ./README.md
# Expected: API key auto-generated, file uploaded, URL returned
```

- [ ] **Step 2: Test single file share in browser**

Open the returned URL. Verify: markdown renders with correct theme, TOC works, HTML export downloads valid file.

- [ ] **Step 3: Test folder share**

```bash
lightsee expose ./docs
# Expected: all md files uploaded, URL returned with directory tree
```

- [ ] **Step 4: Test re-push**

```bash
lightsee expose ./docs
# Expected: "Updated existing share", same URL
```

- [ ] **Step 5: Test list and remove**

```bash
lightsee list
lightsee remove <slug>
```

- [ ] **Step 6: Test desktop app Cloud button**

Open app, click "Cloud" in toolbar, click "Cloud Share", verify URL, test "Update" and "Remove".

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: complete cloud share & CLI integration"
```
