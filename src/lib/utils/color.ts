/**
 * Colour parsing and WCAG contrast. Zero dependencies.
 *
 * Only `#rrggbb` is understood (no shorthand, no named colours, no alpha): a website's brand colours
 * are stored in that one form, and what is not that form is treated as black for contrast and
 * returned unchanged by `readableCopy`. Used to keep text legible whichever colours a municipality
 * picks.
 */

const HEX_RADIX = 16;
const HEX_BYTE_LENGTH = 2;
const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** An sRGB colour by channel, each 0–255. */
export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/**
 * `#rrggbb` (any case) as channels; anything else, including shorthand `#rgb`, is `null`.
 *
 * @example parseHexColor('#1F3A34') // { red: 31, green: 58, blue: 52 }
 */
export function parseHexColor(hex: string): RgbColor | null {
  const match = HEX_COLOR.exec(hex);
  if (match === null) {
    return null;
  }
  const [, red = '', green = '', blue = ''] = match;
  return {
    red: Number.parseInt(red, HEX_RADIX),
    green: Number.parseInt(green, HEX_RADIX),
    blue: Number.parseInt(blue, HEX_RADIX),
  };
}

/**
 * Channels as lowercase `#rrggbb`. Channels are taken as whole numbers 0–255 (what
 * `parseHexColor` returns); other values are not clamped.
 */
export function toHexColor({ red, green, blue }: RgbColor): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(HEX_RADIX).padStart(HEX_BYTE_LENGTH, '0'))
    .join('')}`;
}

/*
 * WCAG 2.x contrast, so text on a brand colour (and a brand colour as text)
 * stays legible whichever colours a municipality picks.
 */
const CHANNEL_MAX = 255;
const LINEAR_THRESHOLD = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA_EXPONENT = 2.4;
const CONTRAST_OFFSET = 0.05;
/** Anything that is not `#rrggbb` is treated as black. */
const BLACK: RgbColor = { red: 0, green: 0, blue: 0 };
const LUMINANCE_WEIGHTS = { red: 0.2126, green: 0.7152, blue: 0.0722 } as const;

function linearChannel(channel: number): number {
  const value = channel / CHANNEL_MAX;
  return value <= LINEAR_THRESHOLD
    ? value / LINEAR_DIVISOR
    : ((value + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA_EXPONENT;
}

function relativeLuminance(hex: string): number {
  const { red, green, blue } = parseHexColor(hex) ?? BLACK;
  return (
    LUMINANCE_WEIGHTS.red * linearChannel(red) +
    LUMINANCE_WEIGHTS.green * linearChannel(green) +
    LUMINANCE_WEIGHTS.blue * linearChannel(blue)
  );
}

/**
 * The contrast ratio of two `#rrggbb` colours, from 1 (identical) to 21 (black on white), in
 * either order. A value that is not `#rrggbb` counts as black.
 *
 * @example contrastRatio('#000000', '#ffffff') // 21
 */
export function contrastRatio(first: string, second: string): number {
  const [lighter = 0, darker = 0] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + CONTRAST_OFFSET) / (darker + CONTRAST_OFFSET);
}

const LIGHT_FOREGROUND = '#ffffff';
/**
 * Pure black, not near-black: white and black meet at about 4.58:1 on the worst
 * mid-tone, so one of them always reaches WCAG AA (4.5:1) for body text. A
 * lighter dark such as #111111 leaves a band of mid-tone brand colours at 4.46:1.
 */
const DARK_FOREGROUND = '#000000';

/**
 * White or black, whichever contrasts more with `background` (`#rrggbb`): text on a brand-coloured
 * button.
 *
 * @example readableForeground('#1f3a34') // '#ffffff'
 */
export function readableForeground(background: string): string {
  return contrastRatio(background, LIGHT_FOREGROUND) >= contrastRatio(background, DARK_FOREGROUND)
    ? LIGHT_FOREGROUND
    : DARK_FOREGROUND;
}

/** WCAG AA for body text. */
const MIN_TEXT_CONTRAST = 4.5;
/** Each darkening step keeps this much less of the colour's brightness: fine enough to stay close to the brand colour. */
const DARKEN_STEP = 0.02;
/** After this many steps the colour is black, which every page background reads. */
const DARKEN_STEP_COUNT = 50;
/**
 * What text sits on: the platform's `--civo-color-surface` and
 * `--civo-color-background`, which a website theme does not change (a test
 * pins them to `globals.css`).
 */
export const PAGE_BACKGROUNDS = ['#ffffff', '#f6f4ee'] as const;

function darkened(color: RgbColor, step: number): string {
  const keep = 1 - step * DARKEN_STEP;
  return toHexColor({
    red: Math.round(color.red * keep),
    green: Math.round(color.green * keep),
    blue: Math.round(color.blue * keep),
  });
}

function isReadableOnPage(color: string): boolean {
  return PAGE_BACKGROUNDS.every(
    (background) => contrastRatio(color, background) >= MIN_TEXT_CONTRAST,
  );
}

/**
 * The brand colour as text or an icon colour (`--civo-color-*-copy`): the
 * colour itself when it is already readable on the page, else the nearest
 * darker shade that is. The raw colour is not safe as text: a light accent
 * such as cyan reaches 1.5:1. Not `#rrggbb`: returned as given. A readable `#rrggbb` comes back
 * lowercased.
 *
 * @example readableCopy('#00ffff') // a dark cyan that reaches 4.5:1 on both page backgrounds
 */
export function readableCopy(color: string): string {
  const channels = parseHexColor(color);
  if (channels === null) {
    return color;
  }
  if (isReadableOnPage(color)) {
    return toHexColor(channels);
  }
  // The last step is black, so the search always ends, whatever the page backgrounds are.
  for (let step = 1; ; step += 1) {
    const candidate = darkened(channels, step);
    if (step >= DARKEN_STEP_COUNT || isReadableOnPage(candidate)) {
      return candidate;
    }
  }
}
