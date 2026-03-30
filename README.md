# Lightsee

A lightweight, cross-platform Markdown viewer built with Tauri 2.

## Features

- **Markdown Rendering** — Powered by [marked](https://github.com/markedjs/marked) with [DOMPurify](https://github.com/cure53/DOMPurify) sanitization
- **17+ Themes** — Light, Dark, Sepia, Nord, Solarized, Dracula, GitHub, Monokai, Catppuccin (Mocha/Macchiato/Frappé/Latte), Gradianto (Deep Ocean/Nature Green/Dark Fuchsia/Midnight Blue), Monocai
- **Tab-based Viewing** — Open multiple Markdown files in tabs
- **Left Sidebar** — Recent files list and favorite folder tree browser
- **Right Sidebar (TOC)** — Auto-generated table of contents with scroll sync
- **Resizable Sidebars** — Drag to adjust sidebar widths
- **Drag & Drop** — Drop `.md` files directly into the window
- **File Association** — Double-click `.md` files to open in Lightsee (supports md, markdown, mdown, mkd, mdwn)
- **Font Size Control** — Adjust with toolbar buttons or keyboard shortcuts
- **Persistent Settings** — Theme, font size, recent files, window size, sidebar state are saved across sessions
- **Auto-Update** — Built-in update checker with one-click install
- **D2Coding Font** — Ligature-supported monospace font for code blocks

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + T` | Open file |
| `Cmd/Ctrl + W` | Close current tab |
| `Cmd/Ctrl + =` | Increase font size |
| `Cmd/Ctrl + -` | Decrease font size |
| `Cmd/Ctrl + 0` | Reset font size |

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 7
- **Backend**: Rust (Tauri 2)
- **Tauri Plugins**: dialog, fs, store, updater, process, opener

## Development

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/)

### Setup

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Bundle targets: `.app`, `.dmg` (macOS), NSIS installer (Windows)

## Project Structure

```
src/                  # React frontend
├── App.tsx           # Main application (tabs, themes, toolbar, layout)
├── App.css           # Global styles and markdown rendering styles
├── LeftSidebar.tsx   # Recent files and favorite folder tree
├── RightSidebar.tsx  # Table of contents with scroll sync
└── main.tsx          # Entry point

src-tauri/            # Rust backend
├── src/lib.rs        # Tauri commands (file reading, directory scanning, file association handling)
├── src/main.rs       # Application entry point
└── tauri.conf.json   # Tauri configuration
```

## License

Private
