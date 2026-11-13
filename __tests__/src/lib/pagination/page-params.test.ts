import { describe, expect, it } from 'vitest';

import { pageHrefOf, pageParamsSchema } from '@lib/pagination';

describe('pageParamsSchema', () => {
  it('keeps single values and drops repeated or missing ones', () => {
    expect(pageParamsSchema.parse({ page: '2', pageSize: '50' })).toEqual({
      page: '2',
      pageSize: '50',
    });
    expect(pageParamsSchema.parse({ page: ['1', '2'] })).toEqual({ page: undefined });
    expect(pageParamsSchema.parse({})).toEqual({});
  });
});

describe('pageHrefOf', () => {
  it('leaves page 1 out of the address and keeps the resolved size', () => {
    expect(pageHrefOf('/websites', 1, { pageSize: 48 })).toBe('/websites?pageSize=48');
    expect(pageHrefOf('/websites', 2, { pageSize: 48 })).toBe('/websites?page=2&pageSize=48');
  });

  it('carries filters along and skips empty ones', () => {
    expect(pageHrefOf('/media', 3, { pageSize: 25, q: 'logo', type: undefined })).toBe(
      '/media?q=logo&page=3&pageSize=25',
    );
  });
});
