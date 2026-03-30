import { useState, useEffect, useCallback, useRef } from "react";

export interface Heading {
  id: string;
  text: string;
  level: number;
}

interface RightSidebarProps {
  headings: Heading[];
  theme: {
    codeBg: string;
    text: string;
    link: string;
    border: string;
  };
  contentRef: React.RefObject<HTMLDivElement | null>;
}

export default function RightSidebar({ headings, theme, contentRef }: RightSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Find the minimum heading level for relative indentation
  const minLevel = headings.length > 0 ? Math.min(...headings.map((h) => h.level)) : 1;

  // Set up IntersectionObserver to track which heading is in view
  useEffect(() => {
    const container = contentRef.current;
    if (!container || headings.length === 0) {
      setActiveId(null);
      return;
    }

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const headingElements = headings
      .map((h) => container.querySelector(`#${CSS.escape(h.id)}`))
      .filter((el): el is Element => el !== null);

    if (headingElements.length === 0) return;

    const visibleIds = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleIds.add(entry.target.id);
          } else {
            visibleIds.delete(entry.target.id);
          }
        });

        // Pick the first visible heading in document order
        for (const h of headings) {
          if (visibleIds.has(h.id)) {
            setActiveId(h.id);
            return;
          }
        }
      },
      {
        root: container,
        rootMargin: "0px 0px -80% 0px",
        threshold: 0,
      }
    );

    headingElements.forEach((el) => observer.observe(el));
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [headings, contentRef]);

  const scrollToHeading = useCallback(
    (id: string) => {
      const container = contentRef.current;
      if (!container) return;
      const el = container.querySelector(`#${CSS.escape(id)}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [contentRef]
  );

  if (headings.length === 0) {
    return (
      <div
        className="sidebar sidebar-right"
        style={{ backgroundColor: theme.codeBg, "--border-color": theme.border, "--link-color": theme.link, "--code-bg": theme.codeBg } as React.CSSProperties}
      >
        <div className="sidebar-section-title" style={{ color: theme.text }}>Contents</div>
        <div style={{ padding: "12px", fontSize: "12px", opacity: 0.5 }}>No headings</div>
      </div>
    );
  }

  return (
    <div
      className="sidebar sidebar-right"
      style={{ backgroundColor: theme.codeBg, "--border-color": theme.border, "--link-color": theme.link, "--code-bg": theme.codeBg } as React.CSSProperties}
    >
      <div className="sidebar-section-title" style={{ color: theme.text }}>Contents</div>
      <div className="toc-list">
        {headings.map((h) => (
          <button
            key={h.id}
            className={`toc-item ${activeId === h.id ? "active" : ""}`}
            style={{
              paddingLeft: `${12 + (h.level - minLevel) * 14}px`,
              color: activeId === h.id ? theme.link : theme.text,
              borderLeftColor: activeId === h.id ? theme.link : "transparent",
            }}
            onClick={() => scrollToHeading(h.id)}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </div>
    </div>
  );
}
