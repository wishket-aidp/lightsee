import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { renderMarkdown } from "@/lib/markdown";
import { themes } from "@/lib/themes";
import type { Share, ShareFile, ThemeColors } from "@/lib/types";
import MarkdownViewer from "@/components/MarkdownViewer";
import TableOfContents from "@/components/TableOfContents";
import DirectoryTree from "@/components/DirectoryTree";
import HtmlExportButton from "@/components/HtmlExportButton";

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

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
  if (typedFiles.length === 0) notFound();

  const firstFile = typedFiles[0];
  const { data: fileData } = await getSupabase().storage
    .from("lightsee-files")
    .download(firstFile.storage_path);

  const markdown = fileData ? await fileData.text() : "";
  const { html, headings } = renderMarkdown(markdown);

  const isFolder = typedShare.type === "folder";

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
        <span style={{ fontWeight: 600 }}>
          {isFolder ? "📁" : "📄"} {typedShare.title}
        </span>
        <HtmlExportButton html={html} title={firstFile.path} theme={theme} />
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        {isFolder && (
          <DirectoryTree files={typedFiles} currentPath={firstFile.path} slug={slug} theme={theme} />
        )}

        <main style={{ flex: 1, overflow: "auto" }}>
          <MarkdownViewer html={html} theme={theme} />
        </main>

        {headings.length > 0 && (
          <div style={{ width: "220px", minWidth: "220px" }}>
            <TableOfContents headings={headings} theme={theme} />
          </div>
        )}
      </div>
    </div>
  );
}
