import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

interface CloudShareListItem {
  slug: string;
  title: string;
  share_type: string;
  local_path: string | null;
  url: string;
  updated_at: string;
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
  const [shares, setShares] = useState<CloudShareListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await invoke<CloudShareListItem[]>("cloud_list");
      setShares(items);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleExposeFile = useCallback(async () => {
    if (!activeFilePath) return;
    setUploading(true);
    setError(null);
    try {
      await invoke("cloud_expose", { path: activeFilePath, theme: themeName });
      await fetchShares();
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }, [activeFilePath, themeName, fetchShares]);

  const handleExposeFolder = useCallback(async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (!selected) return;
    setUploading(true);
    setError(null);
    try {
      await invoke("cloud_expose", { path: selected, theme: themeName });
      await fetchShares();
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }, [themeName, fetchShares]);

  const handleDelete = useCallback(async (slug: string) => {
    setError(null);
    try {
      await invoke("cloud_remove", { slug });
      await fetchShares();
    } catch (e) {
      setError(String(e));
    }
  }, [fetchShares]);

  const handleCopyUrl = useCallback((slug: string, url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className="share-panel"
      style={{
        backgroundColor: theme.codeBg,
        borderBottom: `1px solid ${theme.border}`,
        padding: "8px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <button
          className="btn btn-sm"
          style={{ color: theme.text, borderColor: theme.border }}
          onClick={handleExposeFile}
          disabled={!activeFilePath || uploading}
        >
          {uploading ? "Uploading..." : "Share File"}
        </button>
        <button
          className="btn btn-sm"
          style={{ color: theme.text, borderColor: theme.border }}
          onClick={handleExposeFolder}
          disabled={uploading}
        >
          Share Folder
        </button>
        <button
          className="btn btn-sm"
          style={{ color: theme.text, borderColor: theme.border }}
          onClick={fetchShares}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
        {!activeFilePath && (
          <span style={{ fontSize: "11px", color: theme.blockquoteText }}>
            Open a file to share it
          </span>
        )}
      </div>

      {error && (
        <div style={{ color: "#e55", fontSize: "12px", marginBottom: "6px" }}>
          {error}
        </div>
      )}

      {shares.length === 0 && !loading && (
        <div style={{ fontSize: "12px", color: theme.blockquoteText, padding: "4px 0" }}>
          No cloud shares yet.
        </div>
      )}

      {shares.length > 0 && (
        <div style={{ maxHeight: "200px", overflowY: "auto" }}>
          <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.blockquoteText }}>
                <th style={{ textAlign: "left", padding: "2px 6px" }}>Title</th>
                <th style={{ textAlign: "left", padding: "2px 6px" }}>Type</th>
                <th style={{ textAlign: "left", padding: "2px 6px" }}>Path</th>
                <th style={{ textAlign: "left", padding: "2px 6px" }}>URL</th>
                <th style={{ textAlign: "left", padding: "2px 6px" }}>Updated</th>
                <th style={{ textAlign: "right", padding: "2px 6px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((share) => (
                <tr key={share.slug} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: "3px 6px", color: theme.text }}>{share.title}</td>
                  <td style={{ padding: "3px 6px", color: theme.blockquoteText }}>{share.share_type}</td>
                  <td style={{ padding: "3px 6px", color: theme.blockquoteText, maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={share.local_path || ""}>
                    {share.local_path || "-"}
                  </td>
                  <td style={{ padding: "3px 6px" }}>
                    <a
                      href={share.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: theme.link, textDecoration: "none" }}
                    >
                      {share.url}
                    </a>
                  </td>
                  <td style={{ padding: "3px 6px", color: theme.blockquoteText, whiteSpace: "nowrap" }}>
                    {formatDate(share.updated_at)}
                  </td>
                  <td style={{ padding: "3px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-sm"
                      style={{ color: theme.text, borderColor: theme.border, marginRight: "4px", fontSize: "11px" }}
                      onClick={() => handleCopyUrl(share.slug, share.url)}
                    >
                      {copiedSlug === share.slug ? "Copied!" : "Copy URL"}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ color: "#e55", borderColor: theme.border, fontSize: "11px" }}
                      onClick={() => handleDelete(share.slug)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
