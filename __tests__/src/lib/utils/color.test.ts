import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  PAGE_BACKGROUNDS,
  parseHexColor,
  readableCopy,
  readableForeground,
  toHexColor,
} from '@lib/utils/color';

describe('parseHexColor', () => {
  it('reads #rrggbb in any case', () => {
    expect(parseHexColor('#1F3a34')).toEqual({ red: 31, green: 58, blue: 52 });
  });

  it.each(['#fff', '1f3a34', '#1f3a3', '#1f3a34ff', 'var(--x)', '', 'red'])(
    'rejects %j',
    (input) => {
      expect(parseHexColor(input)).toBeNull();
    },
  );
});

describe('toHexColor', () => {
  it('writes lowercase, zero-padded #rrggbb', () => {
    expect(toHexColor({ red: 0, green: 10, blue: 255 })).toBe('#000aff');
  });

  it('round-trips with parseHexColor', () => {
    expect(toHexColor(parseHexColor('#C9782F') ?? { red: 0, green: 0, blue: 0 })).toBe('#c9782f');
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white, in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('is 1 for identical colours', () => {
    expect(contrastRatio('#1f3a34', '#1f3a34')).toBeCloseTo(1, 5);
  });

  it('matches the WCAG reference for mid-grey on white (about 4.48)', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('treats a value that is not #rrggbb as black', () => {
    expect(contrastRatio('not a colour', '#ffffff')).toBeCloseTo(21, 5);
  });
});

describe('readableForeground', () => {
  it('is white on a dark background and black on a light one', () => {
    expect(readableForeground('#1f3a34')).toBe('#ffffff');
    expect(readableForeground('#f6f4ee')).toBe('#000000');
  });

  it('always reaches WCAG AA (4.5:1), even on the worst mid-tones', () => {
    for (let level = 0; level <= 255; level += 5) {
      const grey = toHexColor({ red: level, green: level, blue: level });

      expect(contrastRatio(grey, readableForeground(grey))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('readableCopy', () => {
  const readable = (color: string) =>
    PAGE_BACKGROUNDS.every((background) => contrastRatio(color, background) >= 4.5);

  it('keeps a colour that already reads on the page, normalised to lowercase', () => {
    expect(readableCopy('#1F3A34')).toBe('#1f3a34');
  });

  it.each(['#00ffff', '#ffff00', '#ff9900', '#c9782f', '#ffffff', '#f6f4ee'])(
    'darkens %s until it reads on every page background',
    (color) => {
      const copy = readableCopy(color);

      expect(readable(copy)).toBe(true);
    },
  );

  it('stays close to the brand colour instead of jumping to black', () => {
    expect(readableCopy('#c9782f')).not.toBe('#000000');
  });

  it('returns what is not #rrggbb as given', () => {
    expect(readableCopy('red')).toBe('red');
    expect(readableCopy('#fff')).toBe('#fff');
  });
});
