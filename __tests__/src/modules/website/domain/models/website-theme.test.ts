import { describe, expect, it } from 'vitest';

import {
  createWebsiteTheme,
  DEFAULT_WEBSITE_THEME,
  restoreWebsiteTheme,
} from '@modules/website/domain/models/website-theme';

describe('website theme validation and restoration', () => {
  it('accepts supported tokens and preserves complete hexadecimal colors', () => {
    const theme = {
      ...DEFAULT_WEBSITE_THEME,
      colors: { primary: '#AaBbCc', secondary: '#000000', accent: '#FFFFFF' },
    };
    expect(createWebsiteTheme(theme)._unsafeUnwrap()).toEqual(theme);
    expect(restoreWebsiteTheme(theme)).toEqual(theme);
  });

  it('reports all rejected values together without accepting free-form CSS', () => {
    const result = createWebsiteTheme({
      colors: { primary: 'red', secondary: '#12', accent: 'url(javascript:alert(1))' },
      typography: { headingFont: 'Other', bodyFont: 'Source Serif 4' },
      radius: '100px',
      spacingScale: 'huge',
    });
    expect(Object.keys(result._unsafeUnwrapErr().fieldErrors).sort()).toEqual([
      'colors.accent',
      'colors.primary',
      'colors.secondary',
      'radius',
      'spacingScale',
      'typography.bodyFont',
      'typography.headingFont',
    ]);
  });

  it.each([undefined, null, {}])(
    'restores defaults from an absent or empty stored theme: %s',
    (stored) => {
      expect(restoreWebsiteTheme(stored)).toEqual(DEFAULT_WEBSITE_THEME);
    },
  );

  it('falls back independently for removed, null, and malformed stored values', () => {
    expect(
      restoreWebsiteTheme({
        colors: { primary: '#abcdef', secondary: null, accent: 'red' },
        typography: { headingFont: null, bodyFont: 'Removed font' },
        radius: 'obsolete',
        spacingScale: 'spacious',
      }),
    ).toEqual({
      ...DEFAULT_WEBSITE_THEME,
      colors: { ...DEFAULT_WEBSITE_THEME.colors, primary: '#abcdef' },
      spacingScale: 'spacious',
    });
  });
});
