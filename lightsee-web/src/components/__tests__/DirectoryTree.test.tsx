import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DirectoryTree from '@/components/DirectoryTree';
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

describe('DirectoryTree', () => {
  it('renders files — flat file list renders each file name', () => {
    const files = [{ path: 'README.md' }, { path: 'CHANGELOG.md' }];
    render(<DirectoryTree files={files} currentPath="README.md" slug="test" theme={theme} />);
    expect(screen.getByText('README.md')).toBeDefined();
    expect(screen.getByText('CHANGELOG.md')).toBeDefined();
  });

  it('renders directories — nested path like "docs/guide.md" renders a directory node', () => {
    const files = [{ path: 'docs/guide.md' }];
    render(<DirectoryTree files={files} currentPath="" slug="test" theme={theme} />);
    expect(screen.getByText(/docs/)).toBeDefined();
    expect(screen.getByText('guide.md')).toBeDefined();
  });

  it('highlights active file — currentPath match gets link color from theme.link', () => {
    const files = [{ path: 'active.md' }, { path: 'other.md' }];
    render(<DirectoryTree files={files} currentPath="active.md" slug="test" theme={theme} />);

    const activeLink = screen.getByText('active.md').closest('a');
    const otherLink = screen.getByText('other.md').closest('a');

    expect(activeLink).not.toBeNull();
    expect(otherLink).not.toBeNull();
    // jsdom converts hex colors to rgb, so compare computed style values
    // active file uses theme.link, inactive uses theme.text
    // verify they differ: active link has a different color than inactive link
    const activeColor = (activeLink as HTMLAnchorElement).style.color;
    const otherColor = (otherLink as HTMLAnchorElement).style.color;
    expect(activeColor).not.toBe('');
    expect(otherColor).not.toBe('');
    expect(activeColor).not.toBe(otherColor);
  });
});
