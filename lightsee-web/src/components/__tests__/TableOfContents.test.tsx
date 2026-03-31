import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TableOfContents from '@/components/TableOfContents';
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

const headings = [
  { id: 'intro', text: 'Introduction', level: 1 },
  { id: 'setup', text: 'Setup', level: 2 },
  { id: 'details', text: 'Details', level: 3 },
];

describe('TableOfContents', () => {
  it('renders headings — given headings array, renders all heading texts as links', () => {
    render(<TableOfContents headings={headings} theme={theme} />);
    expect(screen.getByText('Introduction')).toBeDefined();
    expect(screen.getByText('Setup')).toBeDefined();
    expect(screen.getByText('Details')).toBeDefined();

    const links = screen.getAllByRole('link');
    // At least one link per heading
    expect(links.length).toBeGreaterThanOrEqual(3);
  });

  it('empty headings — returns null when headings array is empty', () => {
    const { container } = render(<TableOfContents headings={[]} theme={theme} />);
    expect(container.firstChild).toBeNull();
  });

  it('indentation — h2 has less padding than h3', () => {
    render(<TableOfContents headings={headings} theme={theme} />);

    const h2Link = screen.getByText('Setup').closest('a') as HTMLAnchorElement;
    const h3Link = screen.getByText('Details').closest('a') as HTMLAnchorElement;

    // paddingLeft is computed from (level - minLevel) * 14px
    // h2: (2-1)*14 = 14px, h3: (3-1)*14 = 28px
    const h2Padding = parseInt(h2Link.style.paddingLeft || '0', 10);
    const h3Padding = parseInt(h3Link.style.paddingLeft || '0', 10);

    expect(h2Padding).toBeLessThan(h3Padding);
  });
});
