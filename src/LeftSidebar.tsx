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
  cloudPaths: string[];
  onCloudExpose: (folderPath: string) => void;
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
  cloudPaths,
  onCloudExpose,
}: LeftSidebarProps) {
  const [folderTrees, setFolderTrees] = useState<Map<string, FileEntry[]>>(new Map());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(favoriteFolders));
  const [exposingFolder, setExposingFolder] = useState<string | null>(null);

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

  const refreshFolder = useCallback(async (folder: string) => {
    try {
      const entries = await invoke<FileEntry[]>("list_markdown_files", { path: folder });
      setFolderTrees((prev) => {
        const next = new Map(prev);
        next.set(folder, entries);
        return next;
      });
    } catch { /* ignore */ }
  }, []);

  const handleCloudExpose = useCallback(async (folder: string) => {
    setExposingFolder(folder);
    try {
      await onCloudExpose(folder);
    } finally {
      setExposingFolder(null);
    }
  }, [onCloudExpose]);

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
                  {cloudPaths.includes(folder) && (
                    <span style={{ marginLeft: "4px", opacity: 0.6 }} title="Cloud shared">&#x2601;</span>
                  )}
                </span>
                <span className="folder-actions">
                  <button
                    className="folder-action-btn"
                    title="Refresh file list"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshFolder(folder);
                    }}
                  >
                    &#x21BB;
                  </button>
                  <button
                    className="folder-action-btn"
                    title={cloudPaths.includes(folder) ? "Update cloud share" : "Share to cloud"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloudExpose(folder);
                    }}
                    disabled={exposingFolder === folder}
                  >
                    {exposingFolder === folder ? "..." : "\u2601"}
                  </button>
                  <button
                    className="folder-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFolder(folder);
                    }}
                  >
                    x
                  </button>
                </span>
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
