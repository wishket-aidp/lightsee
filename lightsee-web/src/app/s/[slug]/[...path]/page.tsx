import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { renderMarkdown } from "@/lib/markdown";
import { themes } from "@/lib/themes";
import type { Share, ShareFile, ThemeColors } from "@/lib/types";
import MarkdownViewer from "@/components/MarkdownViewer";
import TableOfContents from "@/components/TableOfContents";
import DirectoryTree from "@/components/DirectoryTree";
import HtmlExportButton from "@/components/HtmlExportButton";

export default async function ShareFilePage({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>;
}) {
  const { slug, path } = await params;
  const filePath = path.join("/");

  const { data: share } = await supabase
    .from("shares")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!share) notFound();

  const typedShare = share as Share;
  const theme: ThemeColors = themes[typedShare.theme] || themes.light;

  const { data: files } = await supabase
    .from("share_files")
    .select("*")
    .eq("share_id", typedShare.id)
    .order("path");

  const typedFiles = (files || []) as ShareFile[];

  const targetFile = typedFiles.find((f) => f.path === filePath);
  if (!targetFile) notFound();

  const { data: fileData } = await supabase.storage
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
        <span style={{ fontWeight: 600 }}>📁 {typedShare.title} / {filePath}</span>
        <HtmlExportButton html={html} title={targetFile.path} theme={theme} />
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        <DirectoryTree files={typedFiles} currentPath={filePath} slug={slug} theme={theme} />

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
