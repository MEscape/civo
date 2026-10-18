/**
 * The neutrals and type of the page itself, as literal
 * values: mail clients resolve neither CSS custom properties nor `color-mix()`.
 * A website theme does not change them (see global.css), so they are not part
 * of the brand. Keep in sync with `:root` in global.css.
 */
export const EMAIL_TOKENS = {
  color: {
    canvas: '#f6f4ee', // --civo-color-background
    surface: '#ffffff', // --civo-color-surface
    copy: '#2e2a24', // --civo-color-text
    // Muted text on the surface; this token meets 4.5:1 there.
    copyMuted: '#5b564c', // --civo-color-text-muted
    border: '#e4e0d5', // --civo-color-border
  },
  // Webfonts do not load in mail clients, so each stack ends in a safe
  // system font close to the real one (Source Serif -> Georgia).
  font: {
    heading: "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif", // --civo-font-heading
    body: "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", // --civo-font-body
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  },
} as const;
