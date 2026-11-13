import { describe, expect, it } from 'vitest';

import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import { toPreviewTheme } from '@modules/website/presentation/theme/preview-theme';

describe('live theme preview', () => {
  it('preserves saved values while fields are empty or half typed', () => {
    expect(toPreviewTheme({}, DEFAULT_WEBSITE_THEME)).toEqual(DEFAULT_WEBSITE_THEME);
    expect(
      toPreviewTheme({ colors: { primary: '#12', secondary: '' } }, DEFAULT_WEBSITE_THEME),
    ).toEqual(DEFAULT_WEBSITE_THEME);
  });

  it('uses complete edited colors and selected theme tokens', () => {
    const changes = {
      colors: { primary: '#112233', secondary: '#445566', accent: '#778899' },
      typography: { headingFont: 'Geist', bodyFont: 'DM Sans' },
      radius: 'lg',
      spacingScale: 'spacious',
    } as const;
    expect(toPreviewTheme(changes, DEFAULT_WEBSITE_THEME)).toEqual(changes);
  });
});
