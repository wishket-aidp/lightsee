import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '@/lib/markdown';

describe('renderMarkdown', () => {
  it('basic rendering — h1 input produces html with <h1> and text', () => {
    const { html } = renderMarkdown('# Hello');
    expect(html).toContain('<h1');
    expect(html).toContain('Hello');
  });

  it('heading extraction — h1, h2, h3 produces 3 heading entries with correct id, text, level', () => {
    const input = '# Title\n\n## Section\n\n### Subsection';
    const { headings } = renderMarkdown(input);
    expect(headings).toHaveLength(3);
    expect(headings[0]).toMatchObject({ id: 'title', text: 'Title', level: 1 });
    expect(headings[1]).toMatchObject({ id: 'section', text: 'Section', level: 2 });
    expect(headings[2]).toMatchObject({ id: 'subsection', text: 'Subsection', level: 3 });
  });

  it('duplicate headings — second ## Same gets id "same-1"', () => {
    const input = '## Same\n\n## Same';
    const { headings } = renderMarkdown(input);
    expect(headings).toHaveLength(2);
    expect(headings[0].id).toBe('same');
    expect(headings[1].id).toBe('same-1');
  });

  it('table wrapping — markdown table is wrapped in <div class="table-wrapper">', () => {
    const input = '| A | B |\n|---|---|\n| 1 | 2 |';
    const { html } = renderMarkdown(input);
    expect(html).toContain('<div class="table-wrapper">');
  });

  it('empty input — html is empty string and headings is empty array', () => {
    const { html, headings } = renderMarkdown('');
    expect(html.trim()).toBe('');
    expect(headings).toEqual([]);
  });

  it('inline code — backtick code produces <code> element', () => {
    const { html } = renderMarkdown('Use `console.log` here');
    expect(html).toContain('<code>');
  });

  it('special characters in headings — slug strips non-word characters', () => {
    const { headings } = renderMarkdown('## Hello, World!');
    expect(headings[0].id).toBe('hello-world');
  });
});
