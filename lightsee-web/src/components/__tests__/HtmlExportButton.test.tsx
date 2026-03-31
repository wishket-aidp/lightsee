import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HtmlExportButton from '@/components/HtmlExportButton';
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

describe('HtmlExportButton', () => {
  it('renders button with "HTML Export" text', () => {
    render(<HtmlExportButton html="<p>hello</p>" title="test.md" theme={theme} />);
    expect(screen.getByRole('button', { name: /HTML Export/i })).toBeDefined();
  });

  it('click triggers download — creates a blob with the correct content and anchor click', () => {
    const mockObjectURL = 'blob:mock-url';
    const createObjectURL = vi.fn().mockReturnValue(mockObjectURL);
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const mockClick = vi.fn();
    const mockAnchor = { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement;
    // Use the original createElement for non-'a' tags to avoid infinite recursion
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      if (tag === 'a') return mockAnchor;
      return originalCreateElement(tag, options);
    });

    render(<HtmlExportButton html="<p>content</p>" title="my-doc.md" theme={theme} />);
    fireEvent.click(screen.getByRole('button'));

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob: Blob = createObjectURL.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/html');
    expect(mockAnchor.download).toBe('my-doc.html');
    expect(mockClick).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith(mockObjectURL);

    createElementSpy.mockRestore();
  });
});
