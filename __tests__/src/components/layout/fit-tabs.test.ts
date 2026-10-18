import { describe, expect, it } from 'vitest';

import { fitTabs } from '@components/layout/fit-tabs';

const MEASURES = { tabs: [80, 60, 90, 70], gap: 20, group: 100, more: 60 };

describe('fitTabs', () => {
  it('keeps every tab, beside the group, when the bar is wide enough', () => {
    // 80+60+90+70 = 300, four gaps = 80, group = 100
    expect(fitTabs(480, MEASURES)).toBe(4);
  });

  it('keeps as many tabs as fit beside the more button, in order', () => {
    // two tabs: 140 + 40 gaps + 60 more = 240
    expect(fitTabs(479, MEASURES)).toBe(3);
    expect(fitTabs(240, MEASURES)).toBe(2);
    expect(fitTabs(239, MEASURES)).toBe(1);
  });

  it('keeps none when not even one fits', () => {
    expect(fitTabs(100, MEASURES)).toBe(0);
  });
});
