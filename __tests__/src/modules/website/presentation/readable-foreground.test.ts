import { describe, expect, it } from 'vitest';

import { readableForeground } from '@modules/website/presentation/theme/readable-foreground';

const WCAG_AA_NORMAL_TEXT = 4.5;
const CHANNEL_STEPS = [0, 51, 102, 128, 153, 204, 255] as const;

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const [a, b] = [luminance(first), luminance(second)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('readableForeground', () => {
  it('picks white on dark and black on light backgrounds', () => {
    expect(readableForeground('#000000')).toBe('#ffffff');
    expect(readableForeground('#ffffff')).toBe('#000000');
  });

  it('reaches WCAG AA for text on any brand colour a municipality can pick', () => {
    for (const red of CHANNEL_STEPS) {
      for (const green of CHANNEL_STEPS) {
        for (const blue of CHANNEL_STEPS) {
          const background = `#${[red, green, blue].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
          expect(contrast(background, readableForeground(background))).toBeGreaterThanOrEqual(
            WCAG_AA_NORMAL_TEXT,
          );
        }
      }
    }
  });
});
