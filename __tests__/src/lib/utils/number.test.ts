import { describe, expect, it } from 'vitest';

import { clamp, formatBytes, formatMoney, formatNumber, formatPercent } from '@lib/utils/number';

describe('clamp', () => {
  it('clamps to the bounds inclusively', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('throws when min exceeds max', () => {
    expect(() => clamp(1, 10, 0)).toThrow(RangeError);
  });
});

describe('formatNumber', () => {
  it('uses locale separators', () => {
    expect(formatNumber(1234.5, 'de-DE')).toBe('1.234,5');
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5');
  });
});

describe('formatPercent', () => {
  it('formats a ratio as a percentage', () => {
    expect(formatPercent(0.256, 'en-US')).toBe('26%');
    expect(formatPercent(0.256, 'en-US', 1)).toBe('25.6%');
  });
});

describe('formatMoney', () => {
  it('converts minor units to a currency string', () => {
    expect(formatMoney(123456, 'EUR', 'en-US')).toBe('€1,234.56');
  });

  it('respects currencies without minor units', () => {
    expect(formatMoney(500, 'JPY', 'en-US')).toBe('¥500');
  });
});

describe('formatBytes', () => {
  it('formats zero and small values as bytes', () => {
    expect(formatBytes(0, 'en-US')).toContain('0');
    expect(formatBytes(512, 'en-US')).toContain('512');
  });

  it('steps up through binary units', () => {
    expect(formatBytes(1024, 'en-US')).toMatch(/1\s?kB/i);
    expect(formatBytes(1024 * 1024 * 1.5, 'en-US')).toMatch(/1\.5\s?MB/i);
  });
});
