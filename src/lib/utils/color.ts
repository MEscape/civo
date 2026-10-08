const HEX_RADIX = 16;
const HEX_BYTE_LENGTH = 2;
const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** An sRGB colour by channel, each 0–255. */
export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/** `#rrggbb` (any case) as channels; anything else, including shorthand `#rgb`, is `null`. */
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

/** Channels as lowercase `#rrggbb`. */
export function toHexColor({ red, green, blue }: RgbColor): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(HEX_RADIX).padStart(HEX_BYTE_LENGTH, '0'))
    .join('')}`;
}
