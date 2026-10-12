import { describe, expect, it } from 'vitest';

import { PAGE_BACKGROUNDS, contrastRatio, readableCopy } from '@lib/utils/color';

const WCAG_AA_NORMAL_TEXT = 4.5;
const CHANNEL_STEPS = [0, 51, 102, 128, 153, 204, 255] as const;

describe('readableCopy', () => {
  it('keeps a colour that is already readable on the page', () => {
    expect(readableCopy('#1F3A34')).toBe('#1f3a34');
  });

  it('darkens a light colour until it reads on every page background', () => {
    const copy = readableCopy('#00E5FF');
    expect(copy).not.toBe('#00e5ff');
    for (const background of PAGE_BACKGROUNDS) {
      expect(contrastRatio(copy, background)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
    }
  });

  it('returns something that is not #rrggbb as given', () => {
    expect(readableCopy('red')).toBe('red');
  });

  it('reaches WCAG AA on any colour a municipality can pick', () => {
    for (const red of CHANNEL_STEPS) {
      for (const green of CHANNEL_STEPS) {
        for (const blue of CHANNEL_STEPS) {
          const color = `#${[red, green, blue].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
          for (const background of PAGE_BACKGROUNDS) {
            expect(contrastRatio(readableCopy(color), background)).toBeGreaterThanOrEqual(
              WCAG_AA_NORMAL_TEXT,
            );
          }
        }
      }
    }
  });
});
