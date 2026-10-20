/**
 * The product's own identity: its name and the platform's default theme, for the places that
 * cannot read CSS custom properties: `theme-color`, the web app manifest and every e-mail (mail
 * clients resolve neither `var()` nor `color-mix()`).
 *
 * `colors` are LITERAL copies of the `--civo-color-*` tokens in `globals.css`. `theme` holds the
 * platform default's choices in the vocabulary a website's theme settings use (radius, fonts,
 * spacing), so a consumer resolves the platform and a branded website the same way. Tests pin
 * the colours to `globals.css` and the tokens to `DEFAULT_WEBSITE_THEME`.
 *
 * The name is a brand, so it is not translated.
 */
export const APP_IDENTITY = {
  name: 'Civo',
  /** The company behind the product, whose logo the product carries. */
  company: 'Artemis Connect',
  colors: {
    primary: '#1f3a34',
    primaryForeground: '#ffffff',
    primaryCopy: '#1f3a34',
    background: '#f6f4ee',
    surface: '#ffffff',
    text: '#2e2a24',
    textMuted: '#5b564c',
    border: '#e4e0d5',
  },
  theme: {
    radius: 'md',
    headingFont: 'Source Serif 4',
    bodyFont: 'Inter',
    spacingScale: 'comfortable',
  },
} as const;
