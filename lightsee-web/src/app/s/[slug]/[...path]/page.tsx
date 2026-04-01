import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { renderMarkdown } from "@/lib/markdown";
import { themes } from "@/lib/themes";
import type { Share, ShareFile, ThemeColors } from "@/lib/types";
import MarkdownViewer from "@/components/MarkdownViewer";
import TableOfContents from "@/components/TableOfContents";
import DirectoryTree from "@/components/DirectoryTree";
import HtmlExportButton from "@/components/HtmlExportButton";
import MobileDrawer from "@/components/MobileDrawer";

export default async function ShareFilePage({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>;
}) {
  const { slug, path } = await params;
  const filePath = path.join("/");

  const { data: share } = await getSupabase()
    .from("shares")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!share) notFound();

  const typedShare = share as Share;
  const theme: ThemeColors = themes[typedShare.theme] || themes.light;

  const { data: files } = await getSupabase()
    .from("share_files")
    .select("*")
    .eq("share_id", typedShare.id)
    .order("path");

  const typedFiles = (files || []) as ShareFile[];

  const targetFile = typedFiles.find((f) => f.path === filePath);
  if (!targetFile) notFound();

  const { data: fileData } = await getSupabase().storage
    .from("lightsee-files")
    .download(targetFile.storage_path);

  const markdown = fileData ? await fileData.text() : "";
  const { html, headings } = renderMarkdown(markdown);

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          borderBottom: `1px solid ${theme.border}`,
          color: theme.text,
          fontSize: "14px",
        }}
      >
        <span className="viewer-header-title" style={{ fontWeight: 600 }}>📁 {typedShare.title} / {filePath}</span>
        <HtmlExportButton html={html} title={targetFile.path} theme={theme} />
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        <div className="dir-sidebar">
          <DirectoryTree files={typedFiles} currentPath={filePath} slug={slug} theme={theme} />
        </div>

        <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
          <MarkdownViewer html={html} theme={theme} />
        </main>

        {headings.length > 0 && (
          <div className="toc-sidebar" style={{ width: "220px", minWidth: "220px" }}>
            <TableOfContents headings={headings} theme={theme} />
          </div>
        )}
      </div>

      <MobileDrawer side="left" icon="📁" theme={theme}>
        <DirectoryTree files={typedFiles} currentPath={filePath} slug={slug} theme={theme} />
      </MobileDrawer>
      {headings.length > 0 && (
        <MobileDrawer side="right" icon="☰" theme={theme}>
          <TableOfContents headings={headings} theme={theme} />
        </MobileDrawer>
      )}
    </div>
  );
}
