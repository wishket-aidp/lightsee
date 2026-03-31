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
