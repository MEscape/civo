/**
 * The product's own identity: one name and the platform colours that
 * browsers need as literal values (`theme-color`, the web app manifest),
 * where CSS custom properties cannot be read. Keep the colours equal to
 * `--civo-color-primary` and `--civo-color-background` in globals.css.
 * The name is a brand, so it is not translated.
 */
export const APP_IDENTITY = {
  name: 'Civo',
  themeColor: '#1f3a34',
  backgroundColor: '#f6f4ee',
} as const;
