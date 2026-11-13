import { describe, expect, it } from 'vitest';

import {
  parsePreviewParams,
  parsePreviewPosition,
} from '@modules/release/presentation/schemas/parse-preview-position-input';

describe('parsePreviewPosition', () => {
  it('normalizes untrusted preview origins with the history limits', () => {
    expect(parsePreviewPosition({ from: ['3', '2'], fromPageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
    expect(parsePreviewPosition({ from: '-1', fromPageSize: 'invalid' })).toEqual({
      page: 1,
      pageSize: 10,
    });
    expect(parsePreviewPosition({ fromPageSize: '500' })).toEqual({ page: 1, pageSize: 50 });
  });
});

describe('parsePreviewParams', () => {
  it('reads the page asked for beside where the preview came from', () => {
    expect(parsePreviewParams({ path: 'about', from: '2' })).toEqual({
      path: 'about',
      from: { page: 2, pageSize: 10 },
    });
  });

  it('keeps an empty path (the home page) apart from no path at all', () => {
    expect(parsePreviewParams({ path: '' }).path).toBe('');
    expect(parsePreviewParams({}).path).toBeUndefined();
  });
});
