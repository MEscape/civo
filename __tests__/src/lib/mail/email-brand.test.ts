import { describe, expect, it } from 'vitest';

import {
  BODY_FONT_FAMILIES,
  DEFAULT_WEBSITE_THEME,
  THEME_FONT_FAMILIES,
  THEME_RADII,
  THEME_SPACING_SCALES,
} from '@modules/website/domain/models/website-theme';
import { themeToCssVariables } from '@modules/website/presentation/theme/theme-css';

import { APP_IDENTITY } from '@lib/config';
import { PLATFORM_EMAIL_BRAND, createEmailBrand } from '@lib/mail';

const PRIMARY = '#7a1f3d';

describe('PLATFORM_EMAIL_BRAND', () => {
  it('is the platform theme, taken from the app identity', () => {
    expect(PLATFORM_EMAIL_BRAND).toMatchObject({
      sender: 'platform',
      color: {
        primary: APP_IDENTITY.colors.primary,
        primaryForeground: APP_IDENTITY.colors.primaryForeground,
        primaryCopy: APP_IDENTITY.colors.primaryCopy,
        canvas: APP_IDENTITY.colors.background,
        surface: APP_IDENTITY.colors.surface,
        text: APP_IDENTITY.colors.text,
        textMuted: APP_IDENTITY.colors.textMuted,
        border: APP_IDENTITY.colors.border,
      },
    });
  });

  it('uses the platform default’s fonts, radius and spacing', () => {
    expect(PLATFORM_EMAIL_BRAND.font.heading).toMatch(/^'Source Serif 4'/);
    expect(PLATFORM_EMAIL_BRAND.font.body).toMatch(/^Inter,/);
    expect(PLATFORM_EMAIL_BRAND.radius).toBe('6px');
    expect(PLATFORM_EMAIL_BRAND.padding).toBe('32px');
  });
});

describe('createEmailBrand: the colour', () => {
  it('takes the primary colour, with text that reads on it and as a link on the card', () => {
    const brand = createEmailBrand({ primary: '#F5D000' });

    expect(brand.sender).toBe('website');
    expect(brand.color.primary).toBe('#f5d000');
    expect(brand.color.primaryForeground).toBe('#000000');
    expect(brand.color.primaryCopy).not.toBe('#f5d000');
  });

  it('keeps the neutrals of the platform: a website theme does not change them', () => {
    const { color } = createEmailBrand({ primary: PRIMARY });

    expect(color).toMatchObject({
      canvas: PLATFORM_EMAIL_BRAND.color.canvas,
      surface: PLATFORM_EMAIL_BRAND.color.surface,
      text: PLATFORM_EMAIL_BRAND.color.text,
      textMuted: PLATFORM_EMAIL_BRAND.color.textMuted,
      border: PLATFORM_EMAIL_BRAND.color.border,
    });
  });

  it.each(['purple', '#fff', '', 'var(--x)', '#7a1f3d; background: url(x)'])(
    'gives the platform’s colours for %j, but still speaks for the website',
    (primary) => {
      const brand = createEmailBrand({ primary });

      expect(brand).toEqual({ ...PLATFORM_EMAIL_BRAND, sender: 'website' });
    },
  );
});

describe('createEmailBrand: the theme tokens', () => {
  it.each(THEME_RADII)('draws the radius %s as the website itself does', (radius) => {
    const css = themeToCssVariables({ ...websiteTheme(), radius });

    expect(createEmailBrand({ primary: PRIMARY, radius }).radius).toBe(css['--civo-radius']);
  });

  it.each(THEME_FONT_FAMILIES)('has a stack that starts with the font %s', (family) => {
    const stack = createEmailBrand({ primary: PRIMARY, headingFont: family }).font.heading;

    expect(stack.replaceAll("'", '')).toMatch(new RegExp(`^${family}`));
  });

  it('uses the body font for the body and the heading font for the heading', () => {
    const { font } = createEmailBrand({
      primary: PRIMARY,
      headingFont: 'Inter',
      bodyFont: BODY_FONT_FAMILIES[1],
    });

    expect(font.heading).toMatch(/^Inter,/);
    expect(font.body).toMatch(/^'DM Sans',/);
  });

  it('gives every font stack a system font to fall back on, since a webfont never loads', () => {
    for (const family of THEME_FONT_FAMILIES) {
      expect(createEmailBrand({ primary: PRIMARY, headingFont: family }).font.heading).toMatch(
        /(serif|sans-serif)$/,
      );
    }
  });

  it('spaces the card by the spacing scale, each scale differently and tighter to looser', () => {
    const paddings = THEME_SPACING_SCALES.map(
      (spacingScale) => createEmailBrand({ primary: PRIMARY, spacingScale }).padding,
    );

    expect(new Set(paddings).size).toBe(THEME_SPACING_SCALES.length);
    expect(paddings.map(Number.parseInt)).toEqual(
      [...paddings.map(Number.parseInt)].sort((a, b) => a - b),
    );
  });

  it.each([null, undefined])('gives the platform’s choice for a token that is %s', (token) => {
    const brand = createEmailBrand({
      primary: PRIMARY,
      radius: token,
      headingFont: token,
      bodyFont: token,
      spacingScale: token,
    });

    expect(brand).toEqual({
      ...PLATFORM_EMAIL_BRAND,
      sender: 'website',
      color: { ...PLATFORM_EMAIL_BRAND.color, ...brand.color },
    });
  });

  it.each([
    'huge',
    '0px; background: url(https://evil.example/x)',
    '</style><script>',
    'constructor',
    '__proto__',
  ])('never writes the unknown token %j into a style', (token) => {
    const brand = createEmailBrand({
      primary: PRIMARY,
      radius: token,
      headingFont: token,
      bodyFont: token,
      spacingScale: token,
    });

    expect(JSON.stringify(brand)).not.toContain(token);
    expect(brand.radius).toBe(PLATFORM_EMAIL_BRAND.radius);
    expect(brand.padding).toBe(PLATFORM_EMAIL_BRAND.padding);
    expect(brand.font).toEqual(PLATFORM_EMAIL_BRAND.font);
  });
});

function websiteTheme() {
  return {
    colors: { ...DEFAULT_WEBSITE_THEME.colors },
    typography: { ...DEFAULT_WEBSITE_THEME.typography },
    radius: DEFAULT_WEBSITE_THEME.radius,
    spacingScale: DEFAULT_WEBSITE_THEME.spacingScale,
  };
}
