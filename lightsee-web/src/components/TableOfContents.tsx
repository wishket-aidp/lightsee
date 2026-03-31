"use client";

import { useState } from "react";
import type { ThemeColors } from "@/lib/types";

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings: Heading[];
  theme: ThemeColors;
}

export default function TableOfContents({ headings, theme }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (headings.length === 0) return null;

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <nav
      style={{
        position: "sticky",
        top: "20px",
        maxHeight: "calc(100vh - 80px)",
        overflowY: "auto",
        padding: "12px 16px",
        fontSize: "13px",
        borderLeft: `2px solid ${theme.border}`,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "8px", color: theme.heading }}>
        Contents
      </div>
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          onClick={() => setActiveId(h.id)}
          style={{
            display: "block",
            padding: "3px 0",
            paddingLeft: `${(h.level - minLevel) * 14}px`,
            color: activeId === h.id ? theme.link : theme.blockquoteText,
            textDecoration: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}
