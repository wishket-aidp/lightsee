"use client";

import { useState } from "react";
import type { ThemeColors } from "@/lib/types";

interface MobileDrawerProps {
  children: React.ReactNode;
  side: "left" | "right";
  icon: string;
  theme: ThemeColors;
}

export default function MobileDrawer({ children, side, icon, theme }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="mobile-drawer-btn"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: "16px",
          ...(side === "left" ? { left: "16px" } : { right: "16px" }),
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: `1px solid ${theme.border}`,
          backgroundColor: theme.codeBg,
          color: theme.text,
          fontSize: "18px",
          cursor: "pointer",
          zIndex: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        {icon}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              ...(side === "left" ? { left: 0 } : { right: 0 }),
              width: "280px",
              backgroundColor: theme.bg,
              borderRight: side === "left" ? `1px solid ${theme.border}` : undefined,
              borderLeft: side === "right" ? `1px solid ${theme.border}` : undefined,
              overflowY: "auto",
              zIndex: 101,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "8px 12px",
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: theme.text,
                  fontSize: "20px",
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
