import { marked } from "marked";

export function renderMarkdown(raw: string): { html: string; headings: Array<{ id: string; text: string; level: number }> } {
  const parsed = marked.parse(raw, { async: false }) as string;
  const wrapped = parsed.replace(/<table([\s\S]*?<\/table>)/g, '<div class="table-wrapper"><table$1</div>');

  const headings: Array<{ id: string; text: string; level: number }> = [];
  const slugCounts = new Map<string, number>();

  const html = wrapped.replace(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi, (_match, tag, attrs, content) => {
    const text = content.replace(/<[^>]*>/g, "").trim();
    let slug = text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
    if (!slug) slug = "heading";
    const count = slugCounts.get(slug) || 0;
    slugCounts.set(slug, count + 1);
    const finalSlug = count > 0 ? `${slug}-${count}` : slug;
    const level = parseInt(tag[1], 10);
    headings.push({ id: finalSlug, text, level });
    return `<${tag}${attrs} id="${finalSlug}">${content}</${tag}>`;
  });

  return { html, headings };
}
