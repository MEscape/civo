/**
 * The file types the platform accepts, as data: adding one is adding a row here and a signature
 * check below. Images only for now. SVG is deliberately absent: it is markup that can carry
 * script, and serving it from a content origin is an XSS decision, not a media one.
 */
export const MEDIA_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

export function isMediaFormat(value: string): value is MediaFormat {
  return (MEDIA_FORMATS as readonly string[]).includes(value);
}

/** How many leading bytes `sniffMediaFormat` needs. */
export const SNIFF_BYTES = 32;

const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;

/** `'ffd8ff'` -> the bytes it spells. Keeps the signatures readable as the hex dumps they come from. */
function bytesOf(hex: string): readonly number[] {
  const pairs = hex.match(new RegExp(`.{${HEX_DIGITS_PER_BYTE}}`, 'g')) ?? [];
  return pairs.map((pair) => Number.parseInt(pair, HEX_RADIX));
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

const JPEG = bytesOf('ffd8ff');
const PNG = bytesOf('89504e470d0a1a0a');
const GIF_BRANDS = new Set(['GIF87a', 'GIF89a']);
const AVIF_BRANDS = new Set(['avif', 'avis']);
const FTYP_AT = 4;
const BRAND_AT = 8;
const BRAND_LENGTH = 4;
const GIF_LENGTH = 6;

/**
 * What the leading bytes of a file say it is, regardless of what the browser or the file name
 * claimed. `null` means none of the accepted types. This is a signature check, not a decoder:
 * it proves the file starts like the type it announced, which is what stops an HTML or
 * executable payload being stored under an image type.
 */
export function sniffMediaFormat(bytes: Uint8Array): MediaFormat | null {
  if (startsWith(bytes, JPEG)) {
    return 'image/jpeg';
  }
  if (startsWith(bytes, PNG)) {
    return 'image/png';
  }
  if (GIF_BRANDS.has(ascii(bytes, 0, GIF_LENGTH))) {
    return 'image/gif';
  }
  if (
    ascii(bytes, 0, FTYP_AT) === 'RIFF' &&
    ascii(bytes, BRAND_AT, BRAND_AT + BRAND_LENGTH) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (
    ascii(bytes, FTYP_AT, BRAND_AT) === 'ftyp' &&
    AVIF_BRANDS.has(ascii(bytes, BRAND_AT, BRAND_AT + BRAND_LENGTH))
  ) {
    return 'image/avif';
  }
  return null;
}

/** The Cache-Control an object is stored with, signed into its upload so the client cannot choose it. */
export function cacheControlFor(visibility: 'public' | 'private'): string {
  // A key is never reused for other content (a replacement is a new asset), so a public file may be cached for good.
  return visibility === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store';
}
