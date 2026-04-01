import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MarkdownViewer from '@/components/MarkdownViewer';
import type { ThemeColors } from '@/lib/types';

const theme: ThemeColors = {
  bg: '#ffffff',
  text: '#1a1a1a',
  heading: '#111111',
  link: '#0066cc',
  codeBg: '#f5f5f5',
  border: '#e0e0e0',
  blockquoteBorder: '#d0d0d0',
  blockquoteText: '#555555',
};

describe('MarkdownViewer', () => {
  it('renders HTML content', () => {
    const { container } = render(
      <MarkdownViewer html="<p>Hello World</p>" theme={theme} />
    );
    expect(container.querySelector('.markdown-body')).not.toBeNull();
    expect(container.textContent).toContain('Hello World');
  });

  it('applies theme colors as CSS custom properties', () => {
    const { container } = render(
      <MarkdownViewer html="<p>test</p>" theme={theme} />
    );
    const body = container.querySelector('.markdown-body') as HTMLElement;
    // jsdom converts hex to rgb
    expect(body.style.color).toBe('rgb(26, 26, 26)');
    expect(body.style.backgroundColor).toBe('rgb(255, 255, 255)');
  });

  it('uses default font size of 16px', () => {
    const { container } = render(
      <MarkdownViewer html="<p>test</p>" theme={theme} />
    );
    const body = container.querySelector('.markdown-body') as HTMLElement;
    expect(body.style.fontSize).toBe('16px');
  });

  it('respects custom font size', () => {
    const { container } = render(
      <MarkdownViewer html="<p>test</p>" theme={theme} fontSize={20} />
    );
    const body = container.querySelector('.markdown-body') as HTMLElement;
    expect(body.style.fontSize).toBe('20px');
  });

  it('applies dark theme colors correctly', () => {
    const darkTheme: ThemeColors = {
      bg: '#1e1e1e',
      text: '#d4d4d4',
      heading: '#e0e0e0',
      link: '#6cb6ff',
      codeBg: '#2d2d2d',
      border: '#404040',
      blockquoteBorder: '#555555',
      blockquoteText: '#999999',
    };
    const { container } = render(
      <MarkdownViewer html="<p>dark</p>" theme={darkTheme} />
    );
    const body = container.querySelector('.markdown-body') as HTMLElement;
    expect(body.style.backgroundColor).toBe('rgb(30, 30, 30)');
    expect(body.style.color).toBe('rgb(212, 212, 212)');
  });

  it('renders empty content without errors', () => {
    const { container } = render(
      <MarkdownViewer html="" theme={theme} />
    );
    const body = container.querySelector('.markdown-body');
    expect(body).not.toBeNull();
    expect(body!.innerHTML).toBe('');
  });

  it('renders complex HTML with headings and lists', () => {
    const html = '<h1 id="title">Title</h1><ul><li>Item 1</li><li>Item 2</li></ul>';
    const { container } = render(
      <MarkdownViewer html={html} theme={theme} />
    );
    expect(container.querySelector('h1')).not.toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });
});
