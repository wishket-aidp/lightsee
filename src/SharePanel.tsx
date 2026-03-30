import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ShareInfo {
  url: string;
  qrSvg: string;
  port: number;
  token: string;
}

interface ShareStatus {
  running: boolean;
  url: string | null;
  connectedClients: number;
  qrSvg: string | null;
  token: string | null;
}

interface SharePanelProps {
  theme: {
    bg: string;
    text: string;
    heading: string;
    link: string;
    codeBg: string;
    border: string;
    blockquoteBorder: string;
    blockquoteText: string;
  };
  activeHtml: string | null;
  fontSize: number;
  fileName: string | null;
  shareInfo: ShareInfo | null;
  onShareInfoChange: (info: ShareInfo | null) => void;
}

export default function SharePanel({ theme, activeHtml, fontSize, fileName, shareInfo, onShareInfoChange }: SharePanelProps) {
  const [clients, setClients] = useState(0);
  const [copied, setCopied] = useState(false);
  const sharing = shareInfo !== null;

  // Poll client count while sharing
  useEffect(() => {
    if (!sharing) return;
    const poll = setInterval(async () => {
      try {
        const status = await invoke<ShareStatus>("get_share_status");
        if (!status.running) {
          onShareInfoChange(null);
          return;
        }
        setClients(status.connectedClients);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [sharing, onShareInfoChange]);

  // Sync content changes to shared server
  useEffect(() => {
    if (!sharing || !activeHtml || !fileName) return;
    invoke("update_shared_content", {
      content: {
        html: activeHtml,
        theme: {
          bg: theme.bg, text: theme.text, heading: theme.heading,
          link: theme.link, codeBg: theme.codeBg, border: theme.border,
          blockquoteBorder: theme.blockquoteBorder, blockquoteText: theme.blockquoteText,
        },
        fontSize,
        fileName,
      },
    }).catch(() => {});
  }, [sharing, activeHtml, theme, fontSize, fileName]);

  const start = useCallback(async () => {
    if (!activeHtml || !fileName) return;
    try {
      const result = await invoke<ShareInfo>("start_sharing", {
        content: {
          html: activeHtml,
          theme: {
            bg: theme.bg, text: theme.text, heading: theme.heading,
            link: theme.link, codeBg: theme.codeBg, border: theme.border,
            blockquoteBorder: theme.blockquoteBorder, blockquoteText: theme.blockquoteText,
          },
          fontSize,
          fileName,
        },
      });
      onShareInfoChange(result);
    } catch { /* ignore */ }
  }, [activeHtml, theme, fontSize, fileName, onShareInfoChange]);

  const stop = useCallback(async () => {
    await invoke("stop_sharing").catch(() => {});
    onShareInfoChange(null);
    setClients(0);
  }, [onShareInfoChange]);

  const copyUrl = useCallback(() => {
    if (shareInfo) {
      navigator.clipboard.writeText(shareInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareInfo]);

  if (!sharing) {
    return (
      <div className="share-panel" style={{ backgroundColor: theme.codeBg, borderBottom: `1px solid ${theme.border}` }}>
        <div className="share-row">
          <button
            className="btn"
            style={{ color: theme.text, borderColor: theme.border }}
            onClick={start}
            disabled={!activeHtml}
          >
            Start Sharing
          </button>
          <span style={{ fontSize: "12px", color: theme.blockquoteText }}>
            Share current document on local network
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="share-panel" style={{ backgroundColor: theme.codeBg, borderBottom: `1px solid ${theme.border}` }}>
      <div className="share-row">
        <button
          className="btn"
          style={{ color: "#fff", backgroundColor: theme.link, borderColor: theme.link }}
          onClick={stop}
        >
          Stop Sharing
        </button>
        <button
          className="btn btn-sm"
          style={{ color: theme.text, borderColor: theme.border }}
          onClick={copyUrl}
        >
          {copied ? "Copied!" : "Copy URL"}
        </button>
        <span className="share-clients" style={{ color: theme.blockquoteText, fontSize: "12px" }}>
          {clients} viewer{clients !== 1 ? "s" : ""} connected
        </span>
      </div>
      <div className="share-details">
        <div className="share-url" style={{ color: theme.link }}>{shareInfo.url}</div>
        {/* QR SVG is generated server-side by the qrcode crate, not user content */}
        <div className="share-qr" dangerouslySetInnerHTML={{ __html: shareInfo.qrSvg }} />
      </div>
    </div>
  );
}
