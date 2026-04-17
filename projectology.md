---
project: lightsee
generated: 2026-04-17
git-hash: d2e63155c22b34dd03bad5d4edbd28be0dfdaece
---

# Lightsee

A cross-platform desktop Markdown viewer built with Tauri 2 + React 19 that renders Markdown files with 17 themes, tabbed interface, TOC navigation, and cloud sharing via Supabase. Targets users who want a lightweight, fast, themeable Markdown viewer with optional web sharing.

## Stack

TypeScript/Rust · React 19 + Tauri 2 · Vite 7 · marked + DOMPurify · Supabase (cloud)

## Architecture

Tauri IPC bridge pattern: React frontend invokes Rust backend via `invoke()` for file I/O and cloud operations; backend emits events back via `tauri::Emitter`. Local state persisted using Tauri store plugin (JSON). Cloud data stored in Supabase (PostgreSQL + Storage).

```
React UI → Tauri invoke() → Rust handlers → filesystem / Supabase API
                ↕ events                         ↕
          Tauri Store (JSON)              Supabase Storage
```

## Modules

### App (src/App.tsx)
Central state container managing tabs, themes, sidebars, settings persistence, keyboard shortcuts, and file opening workflows.
Key: `src/App.tsx`
Uses: Tauri APIs, marked, DOMPurify, LeftSidebar, RightSidebar, CloudSharePanel

### LeftSidebar (src/LeftSidebar.tsx)
Navigation panel with recent files list and favorite folder trees with recursive FileTree component.
Key: `src/LeftSidebar.tsx`
Uses: Tauri invoke (list_markdown_files), dialog

### RightSidebar (src/RightSidebar.tsx)
Table of contents panel with IntersectionObserver-based scroll tracking and click-to-navigate headings.
Key: `src/RightSidebar.tsx`
Uses: IntersectionObserver API

### CloudSharePanel (src/CloudSharePanel.tsx)
Cloud share management UI: expose file/folder, list active shares, delete, copy URL.
Key: `src/CloudSharePanel.tsx`
Uses: Tauri invoke (cloud_expose, cloud_list, cloud_remove), dialog

### Core Backend (src-tauri/src/lib.rs)
Tauri command handlers for file reading, directory scanning, pending file management (file associations, drag-drop), menu setup, CLI routing.
Key: `src-tauri/src/lib.rs`
Uses: Tauri plugins (dialog, fs, store, updater, process, cli), cloud module

### Cloud Module (src-tauri/src/cloud.rs)
Supabase integration: folder/file upload, share metadata CRUD, API key provisioning, ASCII-safe filename encoding.
Key: `src-tauri/src/cloud.rs`
Uses: reqwest, sha2, nanoid, Tauri store

## File Map

### src/
- `main.tsx` — React entry point rendering App into #root
- `App.tsx` — Master component: tabs, themes (17), sidebars, settings, keyboard shortcuts, markdown rendering pipeline
- `LeftSidebar.tsx` — Recent files + favorite folder trees with recursive FileTree component
- `RightSidebar.tsx` — TOC with IntersectionObserver scroll tracking
- `CloudSharePanel.tsx` — Cloud share CRUD UI with share table and actions
- `App.css` — All styles: D2Coding font, theme system, tab bar, sidebars, resizers, markdown rendering, responsive layout
- `vite-env.d.ts` — Vite TypeScript type definitions

### src/__tests__/
- `setup.ts` — Global test config: mocks for all Tauri APIs, IntersectionObserver, CSS.escape, clipboard
- `App.test.tsx` — App component: empty state, toolbar buttons, font size controls, keyboard shortcuts
- `LeftSidebar.test.tsx` — Sidebar: recent files list, folder tree expansion, add/remove folder, cloud expose
- `RightSidebar.test.tsx` — TOC: heading rendering, active heading tracking, click-to-scroll
- `CloudSharePanel.test.tsx` — Cloud panel: share list, expose, delete, copy URL, loading/error states
- `markdown.test.ts` — Markdown processing: rendering elements, heading IDs, sanitization, special chars
- `themes.test.ts` — Theme validation: all 17 themes have required color keys

### src-tauri/src/
- `main.rs` — Minimal entry point calling `lightsee_lib::run()`
- `lib.rs` — Core backend: normalize_path, is_markdown_ext, read_file, list_markdown_files, scan_markdown_dir, get_pending_files, menu setup, event handlers, CLI routing (498 lines + 130 test lines)
- `cloud.rs` — Cloud sharing: cloud_expose, cloud_list, cloud_remove, ascii_safe_segment, collect_markdown_files, ensure_api_key, Supabase REST integration (848 lines + 60+ test lines)

### Config
- `package.json` — npm deps (React 19, Tauri APIs, marked, DOMPurify), dev scripts
- `tauri.conf.json` — Window (900x700), bundle targets (DMG, NSIS), .md file associations, CLI subcommands, updater config
- `Cargo.toml` — Rust deps: tauri, tokio, reqwest, sha2, nanoid + Tauri plugins
- `vite.config.ts` — Vite dev server port 1420, React plugin, Tauri integration
- `vitest.config.ts` — jsdom environment, test patterns, setup file
- `tsconfig.json` — TypeScript configuration

### lightsee-web/
Separate Next.js web viewer for cloud-shared content (cloud share viewer frontend).

## Key Flows

1. **Open File**: dialog.open() → invoke "read_file" → marked.parse() → DOMPurify.sanitize() → extract headings → new Tab in state → render
2. **Cloud Share**: invoke "cloud_expose" → ensure_api_key → collect files → upload to Supabase Storage → create share record → return URL
3. **Theme Switch**: setTheme(key) → CSS custom properties update → all components re-render with new colors → debounced persist to store
4. **File Association (macOS)**: .md double-click → RunEvent::Opened → push to Arc<Mutex\> queue → App polls get_pending_files every 1s → openFilePath
5. **Settings Persistence**: state changes → debounced 500ms → store.set() per key → store.save() flushes JSON

## Data Models

**Tab** — `{ id, fileName, filePath, html, headings[] }` — unit of open content.
**Heading** — `{ id (slug), text, level (1-6) }` — extracted from rendered HTML.
**FileEntry** — `{ name, path, is_dir, children[] }` — recursive directory tree.
**CloudShareRecord** — `{ local_path, share_id, slug, share_type }` — local share metadata.
**CloudShareResult** — `{ url, slug, share_id, files_uploaded }` — API response from cloud_expose.

Storage: Tauri store plugin (JSON at platform config dir) for local settings. Supabase PostgreSQL (shares, share_files tables) + Supabase Storage (lightsee-files bucket) for cloud.

## Build & Deploy

- Build: `npm run build` (tsc + vite) then `npm run tauri build` (Rust + platform bundle)
- Test: `npm run test` (vitest), `cargo test -p lightsee_lib` (Rust unit tests)
- Deploy: GitHub Releases with auto-updater; macOS .dmg, Windows NSIS, Linux AppImage

## Conventions

- React components PascalCase, Rust modules snake_case
- All app state centralized in App.tsx with useState hooks; settings debounced 500ms before persist
- Rust commands use `Result<T, String>` for error handling; async wrappers with spawn_blocking for CPU-bound work
- Inline `#[cfg(test)]` modules at bottom of Rust files with tempdir-based FS tests
- CSS custom properties for theme colors; 17 named themes with required color keys (bg, text, heading, link, codeBg, border, blockquoteBorder, blockquoteText)
- Non-ASCII filenames converted to SHA-256 hash (16 hex chars) + extension for cloud storage compatibility
