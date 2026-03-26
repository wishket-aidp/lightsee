import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { load } from "@tauri-apps/plugin-store";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "./App.css";

const themes = {
  // Built-in
  light: { name: "Light", bg: "#ffffff", text: "#1a1a1a", heading: "#111111", link: "#0066cc", codeBg: "#f5f5f5", border: "#e0e0e0", blockquoteBorder: "#d0d0d0", blockquoteText: "#555555" },
  dark: { name: "Dark", bg: "#1e1e1e", text: "#d4d4d4", heading: "#e0e0e0", link: "#6cb6ff", codeBg: "#2d2d2d", border: "#404040", blockquoteBorder: "#555555", blockquoteText: "#999999" },
  sepia: { name: "Sepia", bg: "#f4ecd8", text: "#5b4636", heading: "#3e2c1c", link: "#8b5e3c", codeBg: "#ebe3d1", border: "#d4c9b0", blockquoteBorder: "#c4b99a", blockquoteText: "#7a6652" },
  nord: { name: "Nord", bg: "#2e3440", text: "#d8dee9", heading: "#eceff4", link: "#88c0d0", codeBg: "#3b4252", border: "#4c566a", blockquoteBorder: "#5e81ac", blockquoteText: "#a0aec0" },
  solarized: { name: "Solarized", bg: "#fdf6e3", text: "#657b83", heading: "#586e75", link: "#268bd2", codeBg: "#eee8d5", border: "#d3cbb7", blockquoteBorder: "#b58900", blockquoteText: "#839496" },
  dracula: { name: "Dracula", bg: "#282a36", text: "#f8f8f2", heading: "#f8f8f2", link: "#8be9fd", codeBg: "#44475a", border: "#6272a4", blockquoteBorder: "#bd93f9", blockquoteText: "#bfbfbf" },
  github: { name: "GitHub", bg: "#ffffff", text: "#24292f", heading: "#1f2328", link: "#0969da", codeBg: "#f6f8fa", border: "#d0d7de", blockquoteBorder: "#d0d7de", blockquoteText: "#656d76" },
  monokai: { name: "Monokai", bg: "#272822", text: "#f8f8f2", heading: "#f92672", link: "#66d9ef", codeBg: "#3e3d32", border: "#49483e", blockquoteBorder: "#a6e22e", blockquoteText: "#a09f93" },
  // Catppuccin
  catMocha: { name: "Catppuccin Mocha", bg: "#1e1e2e", text: "#cdd6f4", heading: "#cdd6f4", link: "#89b4fa", codeBg: "#313244", border: "#45475a", blockquoteBorder: "#cba6f7", blockquoteText: "#a6adc8" },
  catMacchiato: { name: "Catppuccin Macchiato", bg: "#24273a", text: "#cad3f5", heading: "#cad3f5", link: "#8aadf4", codeBg: "#363a4f", border: "#494d64", blockquoteBorder: "#c6a0f6", blockquoteText: "#a5adcb" },
  catFrappe: { name: "Catppuccin Frappé", bg: "#303446", text: "#c6d0f5", heading: "#c6d0f5", link: "#8caaee", codeBg: "#414559", border: "#51576d", blockquoteBorder: "#ca9ee6", blockquoteText: "#a5adce" },
  catLatte: { name: "Catppuccin Latte", bg: "#eff1f5", text: "#4c4f69", heading: "#4c4f69", link: "#1e66f5", codeBg: "#ccd0da", border: "#bcc0cc", blockquoteBorder: "#8839ef", blockquoteText: "#6c6f85" },
  // Gradianto
  gradDeepOcean: { name: "Deep Ocean", bg: "#1c2739", text: "#c1c1c1", heading: "#e2e2e2", link: "#ede891", codeBg: "#243647", border: "#151d2c", blockquoteBorder: "#4a75a2", blockquoteText: "#8a8a8a" },
  gradNatureGreen: { name: "Nature Green", bg: "#20403f", text: "#cccece", heading: "#f1f4f6", link: "#cded91", codeBg: "#1e3b39", border: "#0a373b", blockquoteBorder: "#4aa275", blockquoteText: "#9aacab" },
  gradDarkFuchsia: { name: "Dark Fuchsia", bg: "#3d214e", text: "#c8ccd0", heading: "#c9c9c9", link: "#c9a7d2", codeBg: "#3e1c4c", border: "#311f39", blockquoteBorder: "#643578", blockquoteText: "#9a8aa0" },
  gradMidnightBlue: { name: "Midnight Blue", bg: "#282839", text: "#d4d4d4", heading: "#e2e2e2", link: "#ede891", codeBg: "#3d3d56", border: "#221b3c", blockquoteBorder: "#6b53a5", blockquoteText: "#9a9aac" },
  // Monocai
  monocai: { name: "Monocai", bg: "#2d2a2f", text: "#fcfcfb", heading: "#fcfcfb", link: "#78dce9", codeBg: "#403e42", border: "#7f7e7f", blockquoteBorder: "#ab9df3", blockquoteText: "#727072" },
} as const;

type ThemeKey = keyof typeof themes;

interface Tab {
  id: string;
  fileName: string;
  filePath?: string;
  html: string;
}

let tabIdCounter = 0;

function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeKey>("light");
  const [fontSize, setFontSize] = useState(16);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const currentTheme = themes[theme];
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // Load settings from store on mount
  useEffect(() => {
    (async () => {
      const store = await load("settings.json");
      const savedTheme = await store.get<ThemeKey>("theme");
      if (savedTheme && savedTheme in themes) setTheme(savedTheme);
      const savedFontSize = await store.get<number>("fontSize");
      if (savedFontSize) setFontSize(savedFontSize);
      const savedRecent = await store.get<string[]>("recentFiles");
      if (savedRecent) setRecentFiles(savedRecent);

      // Restore window size
      const savedWindow = await store.get<{ width: number; height: number }>("windowSize");
      if (savedWindow) {
        const win = getCurrentWindow();
        await win.setSize(new LogicalSize(savedWindow.width, savedWindow.height));
      }
    })();
  }, []);

  // Check for updates on mount
  useEffect(() => {
    check().then((update) => {
      if (update) setUpdateVersion(update.version);
    }).catch(() => {});
  }, []);

  const doUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch {
      setUpdating(false);
    }
  }, []);

  // Save window size on resize (debounced, using logical size)
  useEffect(() => {
    const win = getCurrentWindow();
    let timer: ReturnType<typeof setTimeout>;
    const unlisten = win.onResized(async () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const size = await win.innerSize();
        const factor = await win.scaleFactor();
        const logicalWidth = Math.round(size.width / factor);
        const logicalHeight = Math.round(size.height / factor);
        const store = await load("settings.json");
        await store.set("windowSize", { width: logicalWidth, height: logicalHeight });
        await store.save();
      }, 500);
    });
    return () => { clearTimeout(timer); unlisten.then((fn) => fn()); };
  }, []);

  // Save settings to store on change
  useEffect(() => {
    (async () => {
      const store = await load("settings.json");
      await store.set("theme", theme);
      await store.set("fontSize", fontSize);
      await store.set("recentFiles", recentFiles);
      await store.save();
    })();
  }, [theme, fontSize, recentFiles]);

  const addRecentFile = useCallback((filePath: string) => {
    setRecentFiles((prev) => {
      const filtered = prev.filter((f) => f !== filePath);
      return [filePath, ...filtered].slice(0, 10);
    });
  }, []);

  const loadContent = useCallback((fileName: string, markdown: string, filePath?: string) => {
    const raw = marked.parse(markdown, { async: false }) as string;
    const sanitized = DOMPurify.sanitize(raw);
    const html = sanitized.replace(/<table([\s\S]*?<\/table>)/g, '<div class="table-wrapper"><table$1</div>');
    const id = `tab-${++tabIdCounter}`;
    setTabs((prev) => [...prev, { id, fileName, filePath, html }]);
    setActiveTabId(id);
    if (filePath) addRecentFile(filePath);
  }, [addRecentFile]);

  const openFilePath = useCallback(async (filePath: string) => {
    const content = await invoke<string>("read_file", { path: filePath });
    const name = filePath.split(/[/\\]/).pop() || filePath;
    loadContent(name, content, filePath);
  }, [loadContent]);

  const openFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
    });
    if (file) {
      await openFilePath(file);
    }
  }, [openFilePath]);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((currentId) => {
        if (currentId !== id) return currentId;
        if (next.length === 0) return null;
        const closedIndex = prev.findIndex((t) => t.id === id);
        return next[Math.min(closedIndex, next.length - 1)].id;
      });
      return next;
    });
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const text = await file.text();
      loadContent(file.name, text);
    }
  }, [loadContent]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Poll for pending files from backend + listen for live events
  useEffect(() => {
    // Poll pending files (handles startup, open -a, double-click)
    const pollPending = async () => {
      const files = await invoke<string[]>("get_pending_files");
      for (const f of files) {
        await openFilePath(f);
      }
    };
    pollPending();
    const interval = setInterval(pollPending, 1000);

    // Also listen for live events (files opened while app is already running)
    const unlisten = listen<string>("open-file", async (event) => {
      try {
        await openFilePath(event.payload);
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    });

    return () => {
      clearInterval(interval);
      unlisten.then((fn) => fn());
    };
  }, [openFilePath]);

  const isMac = navigator.platform.toUpperCase().includes("MAC");

  // Cmd/Ctrl+T (new tab / open file), Cmd/Ctrl+W (close tab)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key === "t") {
        e.preventDefault();
        openFile();
      }
      if (mod && e.key === "w") {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setFontSize((s) => Math.min(s + 2, 32));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        setFontSize((s) => Math.max(s - 2, 10));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setFontSize(16);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openFile, closeTab, activeTabId]);

  return (
    <div
      className="app"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <header className="toolbar" style={{ borderBottom: `1px solid ${currentTheme.border}` }}>
        <div className="toolbar-left">
          <button className="btn" style={{ color: currentTheme.text, borderColor: currentTheme.border }} onClick={openFile}>
            Open File
          </button>
        </div>
        <div className="toolbar-right">
          {updateVersion && (
            <button
              className="btn btn-update"
              style={{ color: "#fff", backgroundColor: currentTheme.link, borderColor: currentTheme.link }}
              onClick={doUpdate}
              disabled={updating}
            >
              {updating ? "Updating..." : `Update ${updateVersion}`}
            </button>
          )}
          <div className="font-size-controls" style={{ display: "flex", alignItems: "center", gap: "4px", marginRight: "8px" }}>
            <button className="btn btn-sm" style={{ color: currentTheme.text, borderColor: currentTheme.border }} onClick={() => setFontSize((s) => Math.max(s - 2, 10))}>A-</button>
            <span style={{ fontSize: "12px", minWidth: "28px", textAlign: "center" }}>{fontSize}px</span>
            <button className="btn btn-sm" style={{ color: currentTheme.text, borderColor: currentTheme.border }} onClick={() => setFontSize((s) => Math.min(s + 2, 32))}>A+</button>
          </div>
          <button
            className="btn"
            style={{ color: currentTheme.text, borderColor: currentTheme.border }}
            onClick={() => setShowThemePanel(!showThemePanel)}
          >
            Theme
          </button>
        </div>
      </header>

      {tabs.length > 0 && (
        <div className="tab-bar" style={{ borderBottom: `1px solid ${currentTheme.border}` }}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? "tab-active" : ""}`}
              style={{
                borderBottomColor: tab.id === activeTabId ? currentTheme.link : "transparent",
                color: tab.id === activeTabId ? currentTheme.text : currentTheme.blockquoteText,
              }}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="tab-name">{tab.fileName}</span>
              <button
                className="tab-close"
                style={{ color: currentTheme.blockquoteText }}
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {showThemePanel && (
        <div className="theme-panel" style={{ backgroundColor: currentTheme.codeBg, borderBottom: `1px solid ${currentTheme.border}` }}>
          {Object.entries(themes).map(([key, t]) => (
            <button
              key={key}
              className={`theme-chip ${theme === key ? "active" : ""}`}
              style={{
                backgroundColor: t.bg,
                color: t.text,
                border: `2px solid ${theme === key ? t.link : t.border}`,
              }}
              onClick={() => { setTheme(key as ThemeKey); setShowThemePanel(false); }}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <main className="content">
        {activeTab ? (
          <div
            className="markdown-body"
            style={{
              fontSize: `${fontSize}px`,
              "--heading-color": currentTheme.heading,
              "--link-color": currentTheme.link,
              "--code-bg": currentTheme.codeBg,
              "--border-color": currentTheme.border,
              "--blockquote-border": currentTheme.blockquoteBorder,
              "--blockquote-text": currentTheme.blockquoteText,
            } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: activeTab.html }}  // Content is sanitized with DOMPurify in loadContent
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <p>Drop a markdown file here</p>
            <p className="empty-sub">or press <strong>{isMac ? "⌘T" : "Ctrl+T"}</strong> to open a file</p>
            {recentFiles.length > 0 && (
              <div className="recent-files" style={{ marginTop: "24px", textAlign: "left", maxWidth: "400px" }}>
                <p style={{ fontSize: "12px", color: currentTheme.blockquoteText, marginBottom: "8px" }}>Recent Files</p>
                {recentFiles.map((f) => (
                  <button
                    key={f}
                    className="recent-file-item"
                    style={{ color: currentTheme.link, borderColor: currentTheme.border }}
                    onClick={() => openFilePath(f)}
                  >
                    {f.split(/[/\\]/).pop()}
                    <span style={{ fontSize: "11px", color: currentTheme.blockquoteText, marginLeft: "8px" }}>
                      {f.split(/[/\\]/).slice(0, -1).join("/")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
