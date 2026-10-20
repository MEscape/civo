import { describe, expect, it } from 'vitest';

import { validationError } from '@lib/errors';
import { createIdParser, parseValidIds } from '@lib/result/id-parser';

type SiteId = string & { readonly brand: 'SiteId' };

const parseSiteId = createIdParser<SiteId, ReturnType<typeof validationError>>({
  isValid: (raw) => /^[a-z]{3}$/.test(raw),
  brand: (raw) => raw as SiteId,
  mapError: () => validationError('site.invalid_id', 'Invalid id.', {}),
});

describe('createIdParser', () => {
  it('brands a valid id', () => {
    expect(parseSiteId('abc')._unsafeUnwrap()).toBe('abc');
  });

  it('answers the module’s own error for an invalid one', () => {
    expect(parseSiteId('ABC1')._unsafeUnwrapErr()).toMatchObject({ code: 'site.invalid_id' });
  });
});

describe('parseValidIds', () => {
  it('keeps the ids that parse, each once, in first-seen order', () => {
    expect(parseValidIds(['abc', 'bad!', 'def', 'abc'], parseSiteId, 10)).toEqual(['abc', 'def']);
  });

  it('looks at no more than `limit` distinct ids', () => {
    expect(parseValidIds(['abc', 'def', 'ghi'], parseSiteId, 2)).toEqual(['abc', 'def']);
  });

  it('returns nothing for nothing', () => {
    expect(parseValidIds([], parseSiteId, 5)).toEqual([]);
  });
});
