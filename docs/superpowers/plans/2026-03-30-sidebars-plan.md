# Sidebars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left sidebar (recent files + favorite folder tree) and right sidebar (TOC with scroll sync) to the Lightsee markdown viewer.

**Architecture:** Extend the existing single-file App.tsx into a 3-component structure: LeftSidebar, RightSidebar, and App as orchestrator. Add a Rust backend command for recursive directory scanning. Use the existing tauri-plugin-store for persistence.

**Tech Stack:** React 19, TypeScript, Tauri 2, Rust, marked, DOMPurify

**Spec:** `docs/superpowers/specs/2026-03-30-sidebars-design.md`

**Security note:** All markdown HTML is sanitized with DOMPurify before rendering. The existing `dangerouslySetInnerHTML` usage is safe because content passes through `DOMPurify.sanitize()` in the `loadContent` function.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/src/lib.rs` | Modify | Add `FileEntry` struct + `list_markdown_files` command |
| `src/App.tsx` | Modify | 3-column layout, new state, sidebar toggle, resizer, heading extraction |
| `src/LeftSidebar.tsx` | Create | Recent files list + favorite folder tree |
| `src/RightSidebar.tsx` | Create | TOC with heading list + IntersectionObserver scroll sync |
| `src/App.css` | Modify | Sidebar styles, resizer styles, layout changes |

---

### Task 1: Rust Backend — list_markdown_files Command

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add FileEntry struct and list_markdown_files command**

Add the following to `src-tauri/src/lib.rs`, before the `run()` function:

```rust
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
```

- [ ] **Step 2: Register the command in the invoke_handler**

In `lib.rs`, change the invoke_handler line:

```rust
// Before:
.invoke_handler(tauri::generate_handler![get_pending_files, read_file])

// After:
.invoke_handler(tauri::generate_handler![get_pending_files, read_file, list_markdown_files])
```

- [ ] **Step 3: Verify Rust compiles**

Run: `cd /Users/yonggill/source/personal/lightsee && npm run tauri build -- --debug 2>&1 | tail -5`

If compilation fails, fix errors. If it succeeds, continue.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add list_markdown_files Tauri command for recursive directory scanning"
```

---

### Task 2: CSS — Sidebar and Resizer Styles

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add sidebar layout and resizer styles**

Append the following to the end of `src/App.css`:

```css
/* Main Body (3-column layout) */
.main-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Sidebars */
.sidebar {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
  transition: width 0.2s ease;
  user-select: none;
  -webkit-user-select: none;
  height: 100%;
}

.sidebar-left {
  border-right: 1px solid var(--border-color);
}

.sidebar-right {
  border-left: 1px solid var(--border-color);
}

.sidebar-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 12px 6px;
  opacity: 0.6;
}

/* Resizer handle */
.resizer {
  width: 4px;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color 0.15s;
}

.resizer:hover,
.resizer.resizing {
  background-color: var(--link-color);
  opacity: 0.5;
}

/* Left Sidebar: Recent Files */
.recent-list {
  display: flex;
  flex-direction: column;
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
  background: transparent;
  border: none;
  color: inherit;
  text-align: left;
  font-family: inherit;
  gap: 4px;
}

.recent-item:hover {
  background-color: var(--code-bg);
}

.recent-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.recent-item-remove {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  opacity: 0;
  padding: 0 2px;
  color: inherit;
  flex-shrink: 0;
}

.recent-item:hover .recent-item-remove {
  opacity: 0.5;
}

.recent-item-remove:hover {
  opacity: 1 !important;
}

/* Left Sidebar: Folder Tree */
.folder-tree {
  display: flex;
  flex-direction: column;
}

.folder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  border: none;
  color: inherit;
  text-align: left;
  font-family: inherit;
}

.folder-header:hover {
  background-color: var(--code-bg);
}

.folder-remove {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  opacity: 0;
  padding: 0 2px;
  color: inherit;
  flex-shrink: 0;
}

.folder-header:hover .folder-remove {
  opacity: 0.5;
}

.folder-remove:hover {
  opacity: 1 !important;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 3px 12px;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  border: none;
  color: inherit;
  text-align: left;
  font-family: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.tree-item:hover {
  background-color: var(--code-bg);
}

.tree-toggle {
  width: 16px;
  flex-shrink: 0;
  font-size: 10px;
}

.add-folder-btn {
  display: block;
  width: calc(100% - 24px);
  margin: 8px 12px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  border: 1px dashed;
  border-radius: 4px;
  color: inherit;
  font-family: inherit;
  opacity: 0.6;
}

.add-folder-btn:hover {
  opacity: 1;
}

/* Right Sidebar: TOC */
.toc-list {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.toc-item {
  display: block;
  width: 100%;
  padding: 3px 12px;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  color: inherit;
  text-align: left;
  font-family: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.7;
  transition: opacity 0.15s, border-color 0.15s;
}

.toc-item:hover {
  opacity: 1;
  background-color: var(--code-bg);
}

.toc-item.active {
  opacity: 1;
  border-left-color: var(--link-color);
  color: var(--link-color);
}

/* Sidebar toggle buttons in toolbar */
.btn-icon {
  background: transparent;
  border: 1px solid;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
  font-family: inherit;
  line-height: 1;
}

.btn-icon:hover {
  opacity: 0.7;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.css
git commit -m "feat: add sidebar and resizer CSS styles"
```

---

### Task 3: RightSidebar Component — TOC

**Files:**
- Create: `src/RightSidebar.tsx`

- [ ] **Step 1: Create RightSidebar.tsx**

Create `src/RightSidebar.tsx`:

```tsx
import { useState, useEffect, useCallback, useRef } from "react";

export interface Heading {
  id: string;
  text: string;
  level: number;
}

interface RightSidebarProps {
  headings: Heading[];
  theme: {
    codeBg: string;
    text: string;
    link: string;
    border: string;
  };
  contentRef: React.RefObject<HTMLDivElement | null>;
}

export default function RightSidebar({ headings, theme, contentRef }: RightSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Find the minimum heading level for relative indentation
  const minLevel = headings.length > 0 ? Math.min(...headings.map((h) => h.level)) : 1;

  // Set up IntersectionObserver to track which heading is in view
  useEffect(() => {
    const container = contentRef.current;
    if (!container || headings.length === 0) {
      setActiveId(null);
      return;
    }

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const headingElements = headings
      .map((h) => container.querySelector(`#${CSS.escape(h.id)}`))
      .filter((el): el is Element => el !== null);

    if (headingElements.length === 0) return;

    const visibleIds = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleIds.add(entry.target.id);
          } else {
            visibleIds.delete(entry.target.id);
          }
        });

        // Pick the first visible heading in document order
        for (const h of headings) {
          if (visibleIds.has(h.id)) {
            setActiveId(h.id);
            return;
          }
        }
      },
      {
        root: container,
        rootMargin: "0px 0px -80% 0px",
        threshold: 0,
      }
    );

    headingElements.forEach((el) => observer.observe(el));
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [headings, contentRef]);

  const scrollToHeading = useCallback(
    (id: string) => {
      const container = contentRef.current;
      if (!container) return;
      const el = container.querySelector(`#${CSS.escape(id)}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [contentRef]
  );

  if (headings.length === 0) {
    return (
      <div
        className="sidebar sidebar-right"
        style={{ backgroundColor: theme.codeBg, "--border-color": theme.border, "--link-color": theme.link, "--code-bg": theme.codeBg } as React.CSSProperties}
      >
        <div className="sidebar-section-title" style={{ color: theme.text }}>Contents</div>
        <div style={{ padding: "12px", fontSize: "12px", opacity: 0.5 }}>No headings</div>
      </div>
    );
  }

  return (
    <div
      className="sidebar sidebar-right"
      style={{ backgroundColor: theme.codeBg, "--border-color": theme.border, "--link-color": theme.link, "--code-bg": theme.codeBg } as React.CSSProperties}
    >
      <div className="sidebar-section-title" style={{ color: theme.text }}>Contents</div>
      <div className="toc-list">
        {headings.map((h) => (
          <button
            key={h.id}
            className={`toc-item ${activeId === h.id ? "active" : ""}`}
            style={{
              paddingLeft: `${12 + (h.level - minLevel) * 14}px`,
              color: activeId === h.id ? theme.link : theme.text,
              borderLeftColor: activeId === h.id ? theme.link : "transparent",
            }}
            onClick={() => scrollToHeading(h.id)}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/RightSidebar.tsx
git commit -m "feat: add RightSidebar TOC component with scroll sync"
```

---

### Task 4: LeftSidebar Component

**Files:**
- Create: `src/LeftSidebar.tsx`

- [ ] **Step 1: Create LeftSidebar.tsx**

Create `src/LeftSidebar.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileEntry[];
}

interface LeftSidebarProps {
  recentFiles: string[];
  favoriteFolders: string[];
  theme: {
    codeBg: string;
    text: string;
    link: string;
    border: string;
    blockquoteText: string;
  };
  onOpenFile: (filePath: string) => void;
  onAddFolder: (folderPath: string) => void;
  onRemoveFolder: (folderPath: string) => void;
  onRemoveRecent: (filePath: string) => void;
}

function FileTree({
  entries,
  depth,
  theme,
  onOpenFile,
}: {
  entries: FileEntry[];
  depth: number;
  theme: LeftSidebarProps["theme"];
  onOpenFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleDir = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <>
      {entries.map((entry) => {
        if (entry.is_dir) {
          const isOpen = expanded.has(entry.path);
          return (
            <div key={entry.path}>
              <button
                className="tree-item"
                style={{ paddingLeft: `${12 + depth * 14}px`, color: theme.text }}
                onClick={() => toggleDir(entry.path)}
              >
                <span className="tree-toggle">{isOpen ? "\u25BC" : "\u25B6"}</span>
                {entry.name}
              </button>
              {isOpen && (
                <FileTree entries={entry.children} depth={depth + 1} theme={theme} onOpenFile={onOpenFile} />
              )}
            </div>
          );
        }
        return (
          <button
            key={entry.path}
            className="tree-item"
            style={{ paddingLeft: `${12 + depth * 14 + 16}px`, color: theme.text }}
            onClick={() => onOpenFile(entry.path)}
            title={entry.path}
          >
            {entry.name}
          </button>
        );
      })}
    </>
  );
}

export default function LeftSidebar({
  recentFiles,
  favoriteFolders,
  theme,
  onOpenFile,
  onAddFolder,
  onRemoveFolder,
  onRemoveRecent,
}: LeftSidebarProps) {
  const [folderTrees, setFolderTrees] = useState<Map<string, FileEntry[]>>(new Map());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(favoriteFolders));

  // Load folder trees when favoriteFolders changes
  useEffect(() => {
    const loadTrees = async () => {
      const newTrees = new Map<string, FileEntry[]>();
      for (const folder of favoriteFolders) {
        try {
          const entries = await invoke<FileEntry[]>("list_markdown_files", { path: folder });
          newTrees.set(folder, entries);
        } catch {
          newTrees.set(folder, []);
        }
      }
      setFolderTrees(newTrees);
    };
    loadTrees();
  }, [favoriteFolders]);

  // Keep expanded state in sync with folders list
  useEffect(() => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const f of favoriteFolders) {
        next.add(f);
      }
      return next;
    });
  }, [favoriteFolders]);

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const handleAddFolder = useCallback(async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
    });
    if (selected && !favoriteFolders.includes(selected)) {
      onAddFolder(selected);
    }
  }, [favoriteFolders, onAddFolder]);

  const folderName = (path: string) => path.split(/[/\\]/).pop() || path;

  return (
    <div
      className="sidebar sidebar-left"
      style={{ backgroundColor: theme.codeBg, "--border-color": theme.border, "--code-bg": theme.codeBg } as React.CSSProperties}
    >
      {/* Recent Files */}
      <div className="sidebar-section-title" style={{ color: theme.text }}>Recent Files</div>
      <div className="recent-list">
        {recentFiles.length === 0 && (
          <div style={{ padding: "4px 12px", fontSize: "12px", opacity: 0.5 }}>No recent files</div>
        )}
        {recentFiles.map((f) => (
          <div key={f} className="recent-item" onClick={() => onOpenFile(f)} title={f}>
            <span className="recent-item-name">{f.split(/[/\\]/).pop()}</span>
            <button
              className="recent-item-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveRecent(f);
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>

      {/* Favorite Folders */}
      <div className="sidebar-section-title" style={{ color: theme.text, marginTop: "12px" }}>Favorites</div>
      <div className="folder-tree">
        {favoriteFolders.map((folder) => {
          const isOpen = expandedFolders.has(folder);
          const tree = folderTrees.get(folder) || [];
          return (
            <div key={folder}>
              <div className="folder-header" onClick={() => toggleFolder(folder)} title={folder}>
                <span>
                  <span className="tree-toggle">{isOpen ? "\u25BC" : "\u25B6"}</span>
                  {folderName(folder)}
                </span>
                <button
                  className="folder-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFolder(folder);
                  }}
                >
                  x
                </button>
              </div>
              {isOpen && <FileTree entries={tree} depth={1} theme={theme} onOpenFile={onOpenFile} />}
            </div>
          );
        })}
      </div>
      <button
        className="add-folder-btn"
        style={{ color: theme.text, borderColor: theme.border }}
        onClick={handleAddFolder}
      >
        + Add Folder
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/LeftSidebar.tsx
git commit -m "feat: add LeftSidebar component with recent files and folder tree"
```

---

### Task 5: App.tsx — Heading Extraction and Tab Interface Update

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update Tab interface and add heading extraction to loadContent**

In `src/App.tsx`, update the `Tab` interface and `loadContent`:

```typescript
// Update the Tab interface (around line 41):
// Before:
interface Tab {
  id: string;
  fileName: string;
  filePath?: string;
  html: string;
}

// After:
interface Heading {
  id: string;
  text: string;
  level: number;
}

interface Tab {
  id: string;
  fileName: string;
  filePath?: string;
  html: string;
  headings: Heading[];
}
```

- [ ] **Step 2: Update loadContent to inject heading IDs and extract headings**

Replace the `loadContent` callback (around line 140):

```typescript
// Before:
const loadContent = useCallback((fileName: string, markdown: string, filePath?: string) => {
  const raw = marked.parse(markdown, { async: false }) as string;
  const sanitized = DOMPurify.sanitize(raw);
  const html = sanitized.replace(/<table([\s\S]*?<\/table>)/g, '<div class="table-wrapper"><table$1</div>');
  const id = `tab-${++tabIdCounter}`;
  setTabs((prev) => [...prev, { id, fileName, filePath, html }]);
  setActiveTabId(id);
  if (filePath) addRecentFile(filePath);
}, [addRecentFile]);

// After:
const loadContent = useCallback((fileName: string, markdown: string, filePath?: string) => {
  const raw = marked.parse(markdown, { async: false }) as string;
  // Content is sanitized with DOMPurify to prevent XSS before any rendering
  const sanitized = DOMPurify.sanitize(raw);
  const wrapped = sanitized.replace(/<table([\s\S]*?<\/table>)/g, '<div class="table-wrapper"><table$1</div>');

  // Inject IDs into headings and extract heading list
  const headings: Heading[] = [];
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

  const id = `tab-${++tabIdCounter}`;
  setTabs((prev) => [...prev, { id, fileName, filePath, html, headings }]);
  setActiveTabId(id);
  if (filePath) addRecentFile(filePath);
}, [addRecentFile]);
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: extract headings with IDs from markdown for TOC support"
```

---

### Task 6: App.tsx — New State, Persistence, and 3-Column Layout

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports for new components**

At the top of `src/App.tsx`, add:

```typescript
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
```

- [ ] **Step 2: Add new state variables**

Inside the `App` function, after the existing state declarations (after line 58), add:

```typescript
const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
const [leftSidebarWidth, setLeftSidebarWidth] = useState(240);
const [rightSidebarWidth, setRightSidebarWidth] = useState(220);
const [favoriteFolders, setFavoriteFolders] = useState<string[]>([]);
const contentRef = useRef<HTMLDivElement | null>(null);
```

- [ ] **Step 3: Update settings load (useEffect on mount)**

In the existing "Load settings from store on mount" useEffect, add after the recentFiles load:

```typescript
const savedLeftOpen = await store.get<boolean>("leftSidebarOpen");
if (savedLeftOpen !== null && savedLeftOpen !== undefined) setLeftSidebarOpen(savedLeftOpen);
const savedRightOpen = await store.get<boolean>("rightSidebarOpen");
if (savedRightOpen !== null && savedRightOpen !== undefined) setRightSidebarOpen(savedRightOpen);
const savedLeftWidth = await store.get<number>("leftSidebarWidth");
if (savedLeftWidth) setLeftSidebarWidth(savedLeftWidth);
const savedRightWidth = await store.get<number>("rightSidebarWidth");
if (savedRightWidth) setRightSidebarWidth(savedRightWidth);
const savedFavFolders = await store.get<string[]>("favoriteFolders");
if (savedFavFolders) setFavoriteFolders(savedFavFolders);
```

- [ ] **Step 4: Update settings save useEffect**

Update the existing "Save settings to store on change" useEffect. Change the dependency array and add the new keys:

```typescript
// Before:
useEffect(() => {
  if (!settingsLoaded.current) return;
  (async () => {
    const store = await load("settings.json");
    await store.set("theme", theme);
    await store.set("fontSize", fontSize);
    await store.set("recentFiles", recentFiles);
    await store.save();
  })();
}, [theme, fontSize, recentFiles]);

// After:
useEffect(() => {
  if (!settingsLoaded.current) return;
  (async () => {
    const store = await load("settings.json");
    await store.set("theme", theme);
    await store.set("fontSize", fontSize);
    await store.set("recentFiles", recentFiles);
    await store.set("leftSidebarOpen", leftSidebarOpen);
    await store.set("rightSidebarOpen", rightSidebarOpen);
    await store.set("leftSidebarWidth", leftSidebarWidth);
    await store.set("rightSidebarWidth", rightSidebarWidth);
    await store.set("favoriteFolders", favoriteFolders);
    await store.save();
  })();
}, [theme, fontSize, recentFiles, leftSidebarOpen, rightSidebarOpen, leftSidebarWidth, rightSidebarWidth, favoriteFolders]);
```

- [ ] **Step 5: Add folder management callbacks**

After the existing `handleDragOver` callback, add:

```typescript
const addFavoriteFolder = useCallback((folderPath: string) => {
  setFavoriteFolders((prev) => prev.includes(folderPath) ? prev : [...prev, folderPath]);
}, []);

const removeFavoriteFolder = useCallback((folderPath: string) => {
  setFavoriteFolders((prev) => prev.filter((f) => f !== folderPath));
}, []);

const removeRecentFile = useCallback((filePath: string) => {
  setRecentFiles((prev) => prev.filter((f) => f !== filePath));
}, []);
```

- [ ] **Step 6: Add resizer logic**

After the folder management callbacks, add:

```typescript
const startResize = useCallback((side: "left" | "right", startX: number) => {
  const startWidth = side === "left" ? leftSidebarWidth : rightSidebarWidth;
  const setWidth = side === "left" ? setLeftSidebarWidth : setRightSidebarWidth;
  const min = side === "left" ? 160 : 140;
  const max = side === "left" ? 400 : 360;
  const direction = side === "left" ? 1 : -1;

  const onMouseMove = (e: MouseEvent) => {
    const delta = (e.clientX - startX) * direction;
    setWidth(Math.min(max, Math.max(min, startWidth + delta)));
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
}, [leftSidebarWidth, rightSidebarWidth]);
```

- [ ] **Step 7: Update the JSX — toolbar toggle buttons**

In the toolbar `<div className="toolbar-left">`, add toggle buttons after the Open File button:

```tsx
<div className="toolbar-left">
  <button className="btn" style={{ color: currentTheme.text, borderColor: currentTheme.border }} onClick={openFile}>
    Open File
  </button>
  <button
    className="btn-icon"
    style={{ color: currentTheme.text, borderColor: currentTheme.border, opacity: leftSidebarOpen ? 1 : 0.4 }}
    onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
    title="Toggle left sidebar"
  >
    &#9776;
  </button>
  <button
    className="btn-icon"
    style={{ color: currentTheme.text, borderColor: currentTheme.border, opacity: rightSidebarOpen ? 1 : 0.4 }}
    onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
    title="Toggle right sidebar"
  >
    &#8801;
  </button>
</div>
```

- [ ] **Step 8: Update the JSX — 3-column layout**

Replace the `<main className="content">...</main>` block with the new 3-column layout. The CSS custom properties move from `markdown-body` to `content` so sidebar components can also use them:

```tsx
<div className="main-body">
  {leftSidebarOpen && (
    <>
      <div style={{ width: `${leftSidebarWidth}px` }}>
        <LeftSidebar
          recentFiles={recentFiles}
          favoriteFolders={favoriteFolders}
          theme={currentTheme}
          onOpenFile={openFilePath}
          onAddFolder={addFavoriteFolder}
          onRemoveFolder={removeFavoriteFolder}
          onRemoveRecent={removeRecentFile}
        />
      </div>
      <div
        className="resizer"
        onMouseDown={(e) => startResize("left", e.clientX)}
      />
    </>
  )}

  <main
    className="content"
    ref={contentRef}
    style={{
      "--heading-color": currentTheme.heading,
      "--link-color": currentTheme.link,
      "--code-bg": currentTheme.codeBg,
      "--border-color": currentTheme.border,
      "--blockquote-border": currentTheme.blockquoteBorder,
      "--blockquote-text": currentTheme.blockquoteText,
    } as React.CSSProperties}
  >
    {activeTab ? (
      <div
        className="markdown-body"
        style={{ fontSize: `${fontSize}px` }}
        dangerouslySetInnerHTML={{ __html: activeTab.html }}
      />
    ) : (
      <div className="empty-state">
        <div className="empty-icon">&#128196;</div>
        <p>Drop a markdown file here</p>
        <p className="empty-sub">or press <strong>{isMac ? "\u2318T" : "Ctrl+T"}</strong> to open a file</p>
      </div>
    )}
  </main>

  {rightSidebarOpen && (
    <>
      <div
        className="resizer"
        onMouseDown={(e) => startResize("right", e.clientX)}
      />
      <div style={{ width: `${rightSidebarWidth}px` }}>
        <RightSidebar
          headings={activeTab?.headings || []}
          theme={currentTheme}
          contentRef={contentRef}
        />
      </div>
    </>
  )}
</div>
```

Note: The recent files section that was in the empty-state is removed — it now lives in the LeftSidebar permanently.

- [ ] **Step 9: Verify frontend builds**

Run: `cd /Users/yonggill/source/personal/lightsee && npm run build 2>&1 | tail -10`

Fix any TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate sidebars with 3-column layout, resizer, and persistence"
```

---

### Task 7: Integration Testing and Polish

**Files:**
- Modify: `src/App.tsx` (if needed)
- Modify: `src/App.css` (if needed)
- Modify: `src/LeftSidebar.tsx` (if needed)
- Modify: `src/RightSidebar.tsx` (if needed)

- [ ] **Step 1: Run full dev build and test manually**

Run: `cd /Users/yonggill/source/personal/lightsee && npm run tauri dev`

Test checklist:
1. App launches with both sidebars visible
2. Left sidebar shows "Recent Files" and "Favorites" sections
3. Click "Add Folder" opens folder dialog, selecting a folder shows tree
4. Markdown files in the tree are clickable and open as tabs
5. Folder tree shows subdirectories with expand/collapse arrows
6. x button on favorite folder removes it
7. Recent files list updates when opening files
8. x button on recent file removes it from list
9. Right sidebar shows headings from the active document
10. Clicking a TOC item scrolls content to that heading
11. Scrolling content highlights the current heading in TOC
12. Switching tabs updates the TOC
13. Resizer drag works on both sidebars (check min/max limits)
14. Toggle buttons show/hide sidebars
15. Close app, reopen: sidebar state, widths, favorites all restored
16. Theme changes apply to sidebars correctly

- [ ] **Step 2: Fix any issues found during testing**

Address any visual or functional bugs discovered.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete sidebar implementation with polish fixes"
```
