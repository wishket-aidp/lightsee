import { describe, it, expect } from 'vitest';
import { themes } from '@/lib/themes';
import type { ThemeColors } from '@/lib/types';

const EXPECTED_THEME_KEYS = [
  'light', 'dark', 'sepia', 'nord', 'solarized', 'dracula', 'github', 'monokai',
  'catMocha', 'catMacchiato', 'catFrappe', 'catLatte',
  'gradDeepOcean', 'gradNatureGreen', 'gradDarkFuchsia', 'gradMidnightBlue', 'monocai',
  'everforestDark', 'everforestLight',
];

const REQUIRED_COLOR_PROPS: (keyof ThemeColors)[] = [
  'bg', 'text', 'heading', 'link', 'codeBg', 'border', 'blockquoteBorder', 'blockquoteText',
];

describe('themes', () => {
  it('all themes present — themes object has all 19 expected keys', () => {
    expect(Object.keys(themes)).toHaveLength(19);
    for (const key of EXPECTED_THEME_KEYS) {
      expect(themes).toHaveProperty(key);
    }
  });

  it('theme structure — each theme has all 8 required color properties', () => {
    for (const [name, theme] of Object.entries(themes)) {
      for (const prop of REQUIRED_COLOR_PROPS) {
        expect(theme, `${name} missing property "${prop}"`).toHaveProperty(prop);
      }
    }
  });

  it('color format — all color values start with "#"', () => {
    for (const [name, theme] of Object.entries(themes)) {
      for (const prop of REQUIRED_COLOR_PROPS) {
        const value = theme[prop];
        expect(value, `${name}.${prop} should start with "#"`).toMatch(/^#/);
      }
    }
  });

  it('light theme defaults — bg is "#ffffff" and text is "#1a1a1a"', () => {
    expect(themes.light.bg).toBe('#ffffff');
    expect(themes.light.text).toBe('#1a1a1a');
  });
});
