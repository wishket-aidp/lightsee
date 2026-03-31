"use client";

import { useState } from "react";
import type { ThemeColors } from "@/lib/types";

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

interface DirectoryTreeProps {
  files: Array<{ path: string }>;
  currentPath: string;
  slug: string;
  theme: ThemeColors;
}

function buildTree(files: Array<{ path: string }>): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const existing = current.find((n) => n.name === name);

      if (existing) {
        current = existing.children;
      } else {
        const node: TreeNode = {
          name,
          path: parts.slice(0, i + 1).join("/"),
          isDir: !isLast,
          children: [],
        };
        current.push(node);
        current = node.children;
      }
    }
  }

  return root;
}

function TreeItem({
  node, slug, currentPath, theme, depth,
}: {
  node: TreeNode;
  slug: string;
  currentPath: string;
  theme: ThemeColors;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const isActive = node.path === currentPath;

  if (node.isDir) {
    return (
      <div>
        <div
          style={{
            padding: "3px 8px",
            paddingLeft: `${8 + depth * 14}px`,
            cursor: "pointer",
            color: theme.blockquoteText,
            fontSize: "13px",
          }}
          onClick={() => setOpen(!open)}
        >
          {open ? "▼" : "▶"} {node.name}
        </div>
        {open && node.children.map((child) => (
          <TreeItem key={child.path} node={child} slug={slug} currentPath={currentPath} theme={theme} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <a
      href={`/s/${slug}/${node.path}`}
      style={{
        display: "block",
        padding: "3px 8px",
        paddingLeft: `${8 + depth * 14}px`,
        color: isActive ? theme.link : theme.text,
        textDecoration: "none",
        fontSize: "13px",
        backgroundColor: isActive ? theme.codeBg : "transparent",
      }}
    >
      {node.name}
    </a>
  );
}

export default function DirectoryTree({ files, currentPath, slug, theme }: DirectoryTreeProps) {
  const tree = buildTree(files);

  return (
    <nav
      style={{
        width: "220px",
        minWidth: "220px",
        borderRight: `1px solid ${theme.border}`,
        padding: "12px 0",
        overflowY: "auto",
        height: "100%",
      }}
    >
      {tree.map((node) => (
        <TreeItem key={node.path} node={node} slug={slug} currentPath={currentPath} theme={theme} depth={0} />
      ))}
    </nav>
  );
}
