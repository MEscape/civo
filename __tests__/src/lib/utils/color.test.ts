import { describe, expect, it } from 'vitest';

import { parseHexColor, toHexColor } from '@lib/utils/color';

describe('parseHexColor', () => {
  it('reads #rrggbb in any case', () => {
    expect(parseHexColor('#1F3a34')).toEqual({ red: 31, green: 58, blue: 52 });
  });

  it.each(['#fff', '1f3a34', '#1f3a3', '#1f3a34ff', 'var(--x)'])('rejects %s', (input) => {
    expect(parseHexColor(input)).toBeNull();
  });
});

describe('toHexColor', () => {
  it('writes lowercase, zero-padded #rrggbb', () => {
    expect(toHexColor({ red: 0, green: 10, blue: 255 })).toBe('#000aff');
  });

  it('round-trips with parseHexColor', () => {
    expect(toHexColor(parseHexColor('#C9782F') ?? { red: 0, green: 0, blue: 0 })).toBe('#c9782f');
  });
});
