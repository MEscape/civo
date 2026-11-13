const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:', 'tel:']);
// eslint-disable-next-line no-control-regex -- Browsers strip these before parsing URLs, which can turn a local path into another host.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * An address from content that a visitor may be sent to: a path of this site, or a link with a
 * plain protocol. Anything else (`javascript:`, `data:`, protocol-relative `//host`) is `null`.
 */
export function safeContentHref(href: string): string | null {
  const trimmed = href.trim();
  if (CONTROL_CHARACTERS.test(trimmed)) {
    return null;
  }
  if (trimmed.startsWith('/')) {
    // `//host` and `/\host` are read by browsers as another site.
    return trimmed.startsWith('//') || trimmed.startsWith('/\\') ? null : trimmed;
  }
  try {
    return ALLOWED_PROTOCOLS.has(new URL(trimmed).protocol) ? trimmed : null;
  } catch {
    return null;
  }
}
