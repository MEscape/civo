import { parseHexColor } from '@lib/utils';
import type { RgbColor } from '@lib/utils';

/** WCAG 2.x relative luminance and contrast, so text on a theme colour stays legible. */
const LIGHT_FOREGROUND = '#ffffff';
const DARK_FOREGROUND = '#111111';

const CHANNEL_MAX = 255;
const LINEAR_THRESHOLD = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA_EXPONENT = 2.4;
const CONTRAST_OFFSET = 0.05;
/** A theme colour is validated `#rrggbb` upstream; anything else is treated as black. */
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

function contrastRatio(first: number, second: number): number {
  return (Math.max(first, second) + CONTRAST_OFFSET) / (Math.min(first, second) + CONTRAST_OFFSET);
}

/** Picks white or near-black, whichever contrasts more with `background` (`#rrggbb`). */
export function readableForeground(background: string): string {
  const luminance = relativeLuminance(background);
  const againstLight = contrastRatio(luminance, relativeLuminance(LIGHT_FOREGROUND));
  const againstDark = contrastRatio(luminance, relativeLuminance(DARK_FOREGROUND));
  return againstLight >= againstDark ? LIGHT_FOREGROUND : DARK_FOREGROUND;
}
