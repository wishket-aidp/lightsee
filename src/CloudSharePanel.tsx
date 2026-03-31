import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CloudShareResult {
  url: string;
  slug: string;
  share_id: string;
  files_uploaded: number;
}

interface CloudSharePanelProps {
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
  activeFilePath: string | null;
  themeName: string;
}

export default function CloudSharePanel({ theme, activeFilePath, themeName }: CloudSharePanelProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CloudShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const expose = useCallback(async () => {
    if (!activeFilePath) return;
    setUploading(true);
    setError(null);
    try {
      const res = await invoke<CloudShareResult>("cloud_expose", {
        path: activeFilePath,
        theme: themeName,
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }, [activeFilePath, themeName]);

  const copyUrl = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const remove = useCallback(async () => {
    if (!result) return;
    try {
      await invoke("cloud_remove", { slug: result.slug });
      setResult(null);
    } catch (e) {
      setError(String(e));
    }
  }, [result]);

  return (
    <div
      className="share-panel"
      style={{
        backgroundColor: theme.codeBg,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      {error && (
        <div style={{ color: "#e55", fontSize: "12px", padding: "4px 12px" }}>
          {error}
        </div>
      )}

      {!result ? (
        <div className="share-row">
          <button
            className="btn"
            style={{ color: theme.text, borderColor: theme.border }}
            onClick={expose}
            disabled={!activeFilePath || uploading}
          >
            {uploading ? "Uploading..." : "Cloud Share"}
          </button>
          <span style={{ fontSize: "12px", color: theme.blockquoteText }}>
            Publish to cloud for anyone to view
          </span>
        </div>
      ) : (
        <>
          <div className="share-row">
            <button
              className="btn btn-sm"
              style={{ color: theme.text, borderColor: theme.border }}
              onClick={copyUrl}
            >
              {copied ? "Copied!" : "Copy URL"}
            </button>
            <button
              className="btn btn-sm"
              style={{ color: theme.text, borderColor: theme.border }}
              onClick={expose}
              disabled={uploading}
            >
              {uploading ? "Updating..." : "Update"}
            </button>
            <button
              className="btn btn-sm"
              style={{ color: "#e55", borderColor: theme.border }}
              onClick={remove}
            >
              Remove
            </button>
            <span style={{ fontSize: "12px", color: theme.blockquoteText }}>
              {result.files_uploaded} file{result.files_uploaded !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="share-details">
            <div className="share-url" style={{ color: theme.link }}>
              {result.url}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
