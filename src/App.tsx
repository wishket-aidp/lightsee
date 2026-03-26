import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { listen } from "@tauri-apps/api/event";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "./App.css";

const themes = {
  light: { name: "Light", bg: "#ffffff", text: "#1a1a1a", heading: "#111111", link: "#0066cc", codeBg: "#f5f5f5", border: "#e0e0e0", blockquoteBorder: "#d0d0d0", blockquoteText: "#555555" },
  dark: { name: "Dark", bg: "#1e1e1e", text: "#d4d4d4", heading: "#e0e0e0", link: "#6cb6ff", codeBg: "#2d2d2d", border: "#404040", blockquoteBorder: "#555555", blockquoteText: "#999999" },
  sepia: { name: "Sepia", bg: "#f4ecd8", text: "#5b4636", heading: "#3e2c1c", link: "#8b5e3c", codeBg: "#ebe3d1", border: "#d4c9b0", blockquoteBorder: "#c4b99a", blockquoteText: "#7a6652" },
  nord: { name: "Nord", bg: "#2e3440", text: "#d8dee9", heading: "#eceff4", link: "#88c0d0", codeBg: "#3b4252", border: "#4c566a", blockquoteBorder: "#5e81ac", blockquoteText: "#a0aec0" },
  solarized: { name: "Solarized", bg: "#fdf6e3", text: "#657b83", heading: "#586e75", link: "#268bd2", codeBg: "#eee8d5", border: "#d3cbb7", blockquoteBorder: "#b58900", blockquoteText: "#839496" },
  dracula: { name: "Dracula", bg: "#282a36", text: "#f8f8f2", heading: "#f8f8f2", link: "#8be9fd", codeBg: "#44475a", border: "#6272a4", blockquoteBorder: "#bd93f9", blockquoteText: "#bfbfbf" },
  github: { name: "GitHub", bg: "#ffffff", text: "#24292f", heading: "#1f2328", link: "#0969da", codeBg: "#f6f8fa", border: "#d0d7de", blockquoteBorder: "#d0d7de", blockquoteText: "#656d76" },
  monokai: { name: "Monokai", bg: "#272822", text: "#f8f8f2", heading: "#f92672", link: "#66d9ef", codeBg: "#3e3d32", border: "#49483e", blockquoteBorder: "#a6e22e", blockquoteText: "#a09f93" },
} as const;

type ThemeKey = keyof typeof themes;

interface Tab {
  id: string;
  fileName: string;
  html: string;
}

let tabIdCounter = 0;

function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeKey>(() => {
    return (localStorage.getItem("lightsee-theme") as ThemeKey) || "light";
  });
  const [showThemePanel, setShowThemePanel] = useState(false);

  const currentTheme = themes[theme];
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  useEffect(() => {
    localStorage.setItem("lightsee-theme", theme);
  }, [theme]);

  const loadContent = useCallback((fileName: string, markdown: string) => {
    const raw = marked.parse(markdown, { async: false }) as string;
    const html = DOMPurify.sanitize(raw);
    const id = `tab-${++tabIdCounter}`;
    setTabs((prev) => [...prev, { id, fileName, html }]);
    setActiveTabId(id);
  }, []);

  const openFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
    });
    if (file) {
      const content = await readTextFile(file);
      const name = file.split("/").pop() || file;
      loadContent(name, content);
    }
  }, [loadContent]);

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

  // Listen for file open events from OS (double-click .md, drag to dock icon)
  useEffect(() => {
    const unlisten = listen<string>("open-file", async (event) => {
      try {
        const filePath = event.payload;
        const content = await readTextFile(filePath);
        const name = filePath.split("/").pop() || filePath;
        loadContent(name, content);
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [loadContent]);

  // Cmd+T (new tab / open file), Cmd+W (close tab)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "t") {
        e.preventDefault();
        openFile();
      }
      if (e.metaKey && e.key === "w") {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
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
              "--heading-color": currentTheme.heading,
              "--link-color": currentTheme.link,
              "--code-bg": currentTheme.codeBg,
              "--border-color": currentTheme.border,
              "--blockquote-border": currentTheme.blockquoteBorder,
              "--blockquote-text": currentTheme.blockquoteText,
            } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: activeTab.html }}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <p>Drop a markdown file here</p>
            <p className="empty-sub">or press <strong>⌘T</strong> to open a file</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
