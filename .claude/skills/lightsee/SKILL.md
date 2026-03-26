---
name: lightsee
description: Use when the user wants to preview, view, or open a markdown file (.md) in the Lightsee desktop app. Triggers on "preview this", "open in lightsee", "show me this markdown", or viewing .md files visually.
---

# Lightsee - Markdown Viewer

Open markdown files in the Lightsee desktop app.

## Usage

```bash
open -a Lightsee <file-path>
```

## Examples

```bash
# Single file
open -a Lightsee README.md

# Multiple files
open -a Lightsee docs/guide.md docs/api.md

# Current directory markdown
open -a Lightsee *.md
```

## When to Use

- User asks to preview/view a markdown file visually
- User says "open in lightsee" or "show me this markdown"
- User wants to check markdown rendering before committing

## Notes

- Lightsee must be installed in /Applications
- Supports .md, .markdown, .mdown, .mkd, .mdwn extensions
- App remembers theme, font size, and window position
