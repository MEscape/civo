/**
 * String helpers. Zero dependencies.
 * Locale-sensitive display formatting lives in `number.ts` and `date.ts`
 * (i18n.md).
 */

const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  å: 'a',
  ł: 'l',
  đ: 'd',
};

/**
 * Builds a URL-safe slug. German umlauts and `ß` are transliterated
 * (`Bürgerbüro` becomes `buergerbuero`), other accents are stripped, and
 * anything else becomes a hyphen. Returns an empty string when nothing
 * usable remains.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüßæœøåłđ]/g, (char) => TRANSLITERATIONS[char] ?? char)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncates to `maxLength` characters (Unicode code points, so emoji are
 * not split), appending an ellipsis only when truncation actually
 * happened. The ellipsis counts toward `maxLength`.
 */
export function truncate(text: string, maxLength: number): string {
  const characters = Array.from(text);
  if (characters.length <= maxLength) {
    return text;
  }
  if (maxLength <= 1) {
    return '…'.slice(0, Math.max(0, maxLength));
  }
  return `${characters
    .slice(0, maxLength - 1)
    .join('')
    .trimEnd()}…`;
}

/** Uppercases the first character and leaves the rest untouched. */
export function capitalize(text: string): string {
  const [first, ...rest] = Array.from(text);
  return first === undefined ? '' : first.toLocaleUpperCase() + rest.join('');
}

/** Collapses runs of whitespace (including newlines) into single spaces and trims. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  quot: '"',
  amp: '&',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  yen: '¥',
  sect: '§',
  deg: '°',
  plusmn: '±',
  auml: 'ä',
  Auml: 'Ä',
  ouml: 'ö',
  Ouml: 'Ö',
  uuml: 'ü',
  Uuml: 'Ü',
  szlig: 'ß',
  eacute: 'é',
  Eacute: 'É',
  egrave: 'è',
  Egrave: 'È',
  ecirc: 'ê',
  Ecirc: 'Ê',
  agrave: 'à',
  Agrave: 'À',
  acirc: 'â',
  Acirc: 'Â',
  ccedil: 'ç',
  Ccedil: 'Ç',
};

const MAX_UNICODE_CODE_POINT = 0x10ffff;

function parseCodePoint(raw: string, radix: number): string | null {
  const code = Number.parseInt(raw, radix);
  if (!Number.isInteger(code) || code < 0 || code > MAX_UNICODE_CODE_POINT) {
    return null;
  }
  try {
    return String.fromCodePoint(code);
  } catch {
    return null;
  }
}

/** Decodes named, decimal and hexadecimal HTML entities into their plain characters. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|([a-zA-Z0-9]+));/g,
    (match, hex?: string, dec?: string, named?: string) => {
      if (hex !== undefined) {
        return parseCodePoint(hex, 16) ?? match;
      }
      if (dec !== undefined) {
        return parseCodePoint(dec, 10) ?? match;
      }
      if (named !== undefined) {
        return HTML_ENTITIES[named] ?? match;
      }
      return match;
    },
  );
}

/**
 * Removes HTML tags and decodes entities for plain-text previews. This is NOT a sanitizer:
 * never use its output to make untrusted markup safe to render as HTML
 * (security.md: "never render untrusted content as raw HTML; sanitize it
 * first if unavoidable" — this function is a preview helper, not that
 * sanitizer).
 */
export function stripHtml(html: string): string {
  const withoutScripts = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  const spacedBlocks = withoutScripts.replace(
    /<\/?(?:p|div|br|hr|li|h[1-6]|tr|td|th|blockquote|section|article|header|footer)[^>]*>/gi,
    ' ',
  );
  const stripped = spacedBlocks.replace(/<[^>]*>/g, ' ');
  return normalizeWhitespace(decodeHtmlEntities(stripped));
}

/** Escapes the characters that are significant in HTML text and attribute values. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** True when the string has no characters other than whitespace. */
export function isBlank(text: string | null | undefined): boolean {
  return text === null || text === undefined || text.trim().length === 0;
}

/** Trims the text; returns `null` when only whitespace is left. For optional text stored as NULL. */
export function trimToNull(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}
