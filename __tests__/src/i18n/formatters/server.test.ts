import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppFormatters } from '@i18n/formatters/server';

const state = vi.hoisted(() => ({ locale: 'de', timeZone: 'Asia/Tokyo' }));
vi.mock('next-intl/server', () => ({
  getLocale: async () => state.locale,
  getTimeZone: async () => state.timeZone,
}));

beforeEach(() => {
  state.locale = 'de';
  state.timeZone = 'Asia/Tokyo';
});

describe('server formatters', () => {
  it('uses the request locale and time zone', async () => {
    const format = await getAppFormatters();
    expect(format.number(1234.5)).toBe('1.234,5');
    expect(format.dateTime(new Date('2026-10-29T00:00:00Z'))).toContain('09:00');
  });

  it('uses the configured time zone when the request provides none', async () => {
    state.timeZone = '';
    const format = await getAppFormatters();
    expect(format.dateTime(new Date('2026-10-29T00:00:00Z'))).toContain('01:00');
  });
});
