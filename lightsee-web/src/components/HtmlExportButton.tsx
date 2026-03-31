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
