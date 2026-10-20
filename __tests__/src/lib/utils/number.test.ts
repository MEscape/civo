import { describe, expect, it } from 'vitest';

import { clamp, formatBytes, formatMoney, formatNumber, formatPercent } from '@lib/utils/number';

describe('clamp', () => {
  it('keeps a value inside the range, ends included', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('pulls a value back to the nearest end', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('throws when the range is reversed', () => {
    expect(() => clamp(1, 10, 0)).toThrow(RangeError);
  });
});

describe('formatNumber', () => {
  it('follows the locale', () => {
    expect(formatNumber(1234.5, 'de-DE')).toBe('1.234,5');
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5');
  });

  it('takes Intl options', () => {
    expect(formatNumber(0.5, 'en-US', { style: 'percent' })).toBe('50%');
  });
});

describe('formatPercent', () => {
  it('rounds to whole percent by default', () => {
    expect(formatPercent(0.256, 'en-US')).toBe('26%');
  });

  it('shows the requested decimals', () => {
    expect(formatPercent(0.256, 'en-US', 1)).toBe('25.6%');
    expect(formatPercent(0.25, 'en-US', 1)).toBe('25.0%');
  });
});

describe('formatMoney', () => {
  it('converts integer minor units at the edge', () => {
    expect(formatMoney(123456, 'EUR', 'en-US')).toBe('€1,234.56');
    expect(formatMoney(5, 'EUR', 'en-US')).toBe('€0.05');
  });

  it('knows currencies without minor units', () => {
    expect(formatMoney(500, 'JPY', 'en-US')).toBe('¥500');
  });

  it('keeps the sign', () => {
    expect(formatMoney(-250, 'EUR', 'en-US')).toBe('-€2.50');
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60])(
    'refuses %j, which is not a whole amount of minor units',
    (amount) => {
      expect(() => formatMoney(amount, 'EUR', 'en-US')).toThrow(RangeError);
    },
  );
});

describe('formatBytes', () => {
  it.each([
    [0, '0 byte'],
    [512, '512 byte'],
    [1024, '1 kB'],
    [1_572_864, '1.5 MB'],
    [1_073_741_824, '1 GB'],
    [1024 ** 4, '1 TB'],
  ])('writes %d as "%s"', (bytes, expected) => {
    expect(formatBytes(bytes, 'en-US')).toBe(expected);
  });

  it('stops at terabytes', () => {
    expect(formatBytes(1024 ** 5, 'en-US')).toBe('1,024 TB');
  });

  it('keeps the sign', () => {
    expect(formatBytes(-2048, 'en-US')).toBe('-2 kB');
  });

  it('takes the number of decimals', () => {
    expect(formatBytes(1_500_000, 'en-US', 2)).toBe('1.43 MB');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('refuses %j', (bytes) => {
    expect(() => formatBytes(bytes, 'en-US')).toThrow(RangeError);
  });
});
