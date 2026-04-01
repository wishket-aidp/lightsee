import { describe, it, expect } from "vitest";
import { marked } from "marked";
import DOMPurify from "dompurify";

// Replicate the loadContent markdown processing logic from App.tsx for testing
function processMarkdown(markdown: string) {
  const raw = marked.parse(markdown, { async: false }) as string;
  const sanitized = DOMPurify.sanitize(raw);
  const wrapped = sanitized.replace(/<table([\s\S]*?<\/table>)/g, '<div class="table-wrapper"><table$1</div>');

  interface Heading {
    id: string;
    text: string;
    level: number;
  }
  const headings: Heading[] = [];
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

describe("Markdown processing (desktop)", () => {
  describe("basic rendering", () => {
    it("renders h1 heading", () => {
      const { html } = processMarkdown("# Hello World");
      expect(html).toContain("<h1");
      expect(html).toContain("Hello World");
    });

    it("renders paragraphs", () => {
      const { html } = processMarkdown("This is a paragraph.");
      expect(html).toContain("<p>");
      expect(html).toContain("This is a paragraph.");
    });

    it("renders bold and italic text", () => {
      const { html } = processMarkdown("**bold** and *italic*");
      expect(html).toContain("<strong>bold</strong>");
      expect(html).toContain("<em>italic</em>");
    });

    it("renders inline code", () => {
      const { html } = processMarkdown("Use `console.log` here");
      expect(html).toContain("<code>");
      expect(html).toContain("console.log");
    });

    it("renders code blocks", () => {
      const { html } = processMarkdown("```js\nconst x = 1;\n```");
      expect(html).toContain("<pre>");
      expect(html).toContain("<code");
    });

    it("renders links", () => {
      const { html } = processMarkdown("[click](https://example.com)");
      expect(html).toContain("<a");
      expect(html).toContain("https://example.com");
      expect(html).toContain("click");
    });

    it("renders unordered lists", () => {
      const { html } = processMarkdown("- item 1\n- item 2\n- item 3");
      expect(html).toContain("<ul>");
      expect(html).toContain("<li>");
      expect(html).toContain("item 1");
    });

    it("renders ordered lists", () => {
      const { html } = processMarkdown("1. first\n2. second");
      expect(html).toContain("<ol>");
      expect(html).toContain("<li>");
    });

    it("renders blockquotes", () => {
      const { html } = processMarkdown("> This is a quote");
      expect(html).toContain("<blockquote>");
      expect(html).toContain("This is a quote");
    });

    it("renders images", () => {
      const { html } = processMarkdown("![alt text](image.png)");
      expect(html).toContain("<img");
      expect(html).toContain("image.png");
    });

    it("handles empty input", () => {
      const { html, headings } = processMarkdown("");
      expect(html.trim()).toBe("");
      expect(headings).toEqual([]);
    });
  });

  describe("heading extraction", () => {
    it("extracts heading id, text, and level", () => {
      const { headings } = processMarkdown("# Title\n\n## Section\n\n### Subsection");
      expect(headings).toHaveLength(3);
      expect(headings[0]).toMatchObject({ id: "title", text: "Title", level: 1 });
      expect(headings[1]).toMatchObject({ id: "section", text: "Section", level: 2 });
      expect(headings[2]).toMatchObject({ id: "subsection", text: "Subsection", level: 3 });
    });

    it("handles all heading levels h1-h6", () => {
      const input = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
      const { headings } = processMarkdown(input);
      expect(headings).toHaveLength(6);
      for (let i = 0; i < 6; i++) {
        expect(headings[i].level).toBe(i + 1);
      }
    });

    it("deduplicates heading slugs", () => {
      const { headings } = processMarkdown("## Same\n\n## Same\n\n## Same");
      expect(headings).toHaveLength(3);
      expect(headings[0].id).toBe("same");
      expect(headings[1].id).toBe("same-1");
      expect(headings[2].id).toBe("same-2");
    });

    it("strips special characters from slug", () => {
      const { headings } = processMarkdown("## Hello, World!");
      expect(headings[0].id).toBe("hello-world");
    });

    it("handles heading with only special characters", () => {
      const { headings } = processMarkdown("## !!!");
      expect(headings[0].id).toBe("heading");
    });

    it("injects id attribute into heading HTML", () => {
      const { html } = processMarkdown("## My Section");
      expect(html).toContain('id="my-section"');
    });

    it("strips inline HTML from heading text", () => {
      const { headings } = processMarkdown("## Hello **World**");
      expect(headings[0].text).toBe("Hello World");
    });
  });

  describe("table wrapping", () => {
    it("wraps tables in table-wrapper div", () => {
      const input = "| A | B |\n|---|---|\n| 1 | 2 |";
      const { html } = processMarkdown(input);
      expect(html).toContain('<div class="table-wrapper">');
      expect(html).toContain("<table");
    });
  });

  describe("XSS sanitization", () => {
    it("strips script tags", () => {
      const { html } = processMarkdown('<script>alert("xss")</script>');
      expect(html).not.toContain("<script");
    });

    it("strips onclick attributes", () => {
      const { html } = processMarkdown('<div onclick="alert(1)">click</div>');
      expect(html).not.toContain("onclick");
    });

    it("strips javascript: URLs", () => {
      const { html } = processMarkdown('[click](javascript:alert(1))');
      expect(html).not.toContain("javascript:");
    });
  });
});
