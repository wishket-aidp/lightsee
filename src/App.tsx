import { useState, useEffect, useCallback, useRef } from "react";
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
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import SharePanel, { ShareInfo } from "./SharePanel";
import CloudSharePanel from "./CloudSharePanel";
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

let tabIdCounter = 0;

function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeKey>("light");
  const [fontSize, setFontSize] = useState(16);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [updateAvailable, setUpdateAvailable] = useState<Awaited<ReturnType<typeof check>> | null>(null);
  const [updating, setUpdating] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(240);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(220);
  const [favoriteFolders, setFavoriteFolders] = useState<string[]>([]);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showCloudPanel, setShowCloudPanel] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [cloudShares, setCloudShares] = useState<Array<{ local_path: string; slug: string }>>([]);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

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
      const savedCloudShares = await store.get<Array<{ local_path: string; slug: string }>>("cloud_shares");
      if (savedCloudShares) setCloudShares(savedCloudShares);

      // Restore window size
      const savedWindow = await store.get<{ width: number; height: number }>("windowSize");
      if (savedWindow) {
        const win = getCurrentWindow();
        await win.setSize(new LogicalSize(savedWindow.width, savedWindow.height));
      }
      setSettingsLoaded(true);
    })();
  }, []);

  // Check for updates on mount
  useEffect(() => {
    check().then((update) => {
      if (update) setUpdateAvailable(update);
    }).catch(() => {});
  }, []);

  const doUpdate = useCallback(async () => {
    if (!updateAvailable) return;
    setUpdating(true);
    try {
      await updateAvailable.downloadAndInstall();
      await relaunch();
    } catch {
      setUpdating(false);
    }
  }, [updateAvailable]);

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

  // Save settings to store on change (only after initial load)
  useEffect(() => {
    if (!settingsLoaded) return;
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

  const addRecentFile = useCallback((filePath: string) => {
    setRecentFiles((prev) => {
      const filtered = prev.filter((f) => f !== filePath);
      return [filePath, ...filtered].slice(0, 10);
    });
  }, []);

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

  const addFavoriteFolder = useCallback((folderPath: string) => {
    setFavoriteFolders((prev) => prev.includes(folderPath) ? prev : [...prev, folderPath]);
  }, []);

  const removeFavoriteFolder = useCallback((folderPath: string) => {
    setFavoriteFolders((prev) => prev.filter((f) => f !== folderPath));
  }, []);

  const removeRecentFile = useCallback((filePath: string) => {
    setRecentFiles((prev) => prev.filter((f) => f !== filePath));
  }, []);

  const handleCloudExpose = useCallback(async (folderPath: string) => {
    try {
      const result = await invoke<{ url: string; slug: string; share_id: string; files_uploaded: number }>("cloud_expose", {
        path: folderPath,
        theme,
      });
      setCloudShares((prev) => {
        const filtered = prev.filter((s) => s.local_path !== folderPath);
        return [...filtered, { local_path: folderPath, slug: result.slug }];
      });
      navigator.clipboard.writeText(result.url).catch(() => {});
      alert(`Uploaded ${result.files_uploaded} file(s).\nURL copied: ${result.url}`);
    } catch (e) {
      alert(`Cloud share failed: ${e}`);
    }
  }, [theme]);

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
        <div className="toolbar-right">
          {updateAvailable && (
            <button
              className="btn btn-update"
              style={{ color: "#fff", backgroundColor: currentTheme.link, borderColor: currentTheme.link }}
              onClick={doUpdate}
              disabled={updating}
            >
              {updating ? "Updating..." : `Update ${updateAvailable.version}`}
            </button>
          )}
          <div className="font-size-controls" style={{ display: "flex", alignItems: "center", gap: "4px", marginRight: "8px" }}>
            <button className="btn btn-sm" style={{ color: currentTheme.text, borderColor: currentTheme.border }} onClick={() => setFontSize((s) => Math.max(s - 2, 10))}>A-</button>
            <span style={{ fontSize: "12px", minWidth: "28px", textAlign: "center" }}>{fontSize}px</span>
            <button className="btn btn-sm" style={{ color: currentTheme.text, borderColor: currentTheme.border }} onClick={() => setFontSize((s) => Math.min(s + 2, 32))}>A+</button>
          </div>
          <button
            className={`btn ${shareInfo ? "btn-sharing" : ""}`}
            style={{
              color: shareInfo ? "#fff" : currentTheme.text,
              backgroundColor: shareInfo ? currentTheme.link : "transparent",
              borderColor: shareInfo ? currentTheme.link : currentTheme.border,
            }}
            onClick={() => setShowSharePanel(!showSharePanel)}
          >
            {shareInfo ? "Sharing" : "Share"}
          </button>
          <button
            className="btn"
            style={{ color: currentTheme.text, borderColor: currentTheme.border }}
            onClick={() => setShowCloudPanel(!showCloudPanel)}
          >
            Cloud
          </button>
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

      {showSharePanel && (
        <SharePanel
          theme={currentTheme}
          activeHtml={activeTab?.html || null}
          fontSize={fontSize}
          fileName={activeTab?.fileName || null}
          shareInfo={shareInfo}
          onShareInfoChange={setShareInfo}
        />
      )}

      {showCloudPanel && (
        <CloudSharePanel
          theme={currentTheme}
          activeFilePath={activeTab?.filePath || null}
          themeName={theme}
        />
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
                cloudPaths={cloudShares.map(s => s.local_path)}
                onCloudExpose={handleCloudExpose}
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
              // Content is sanitized with DOMPurify in loadContent
              dangerouslySetInnerHTML={{ __html: activeTab.html }}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <p>Drop a markdown file here</p>
              <p className="empty-sub">or press <strong>{isMac ? "⌘T" : "Ctrl+T"}</strong> to open a file</p>
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
    </div>
  );
}

export default App;
