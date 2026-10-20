import { describe, expect, it } from 'vitest';

import {
  buildQueryString,
  isRelativePath,
  isValidUrl,
  joinPath,
  stripTrailingSlash,
} from '@lib/utils/url';

describe('isValidUrl', () => {
  it('accepts http and https by default', () => {
    expect(isValidUrl('https://example.org/a?b=1')).toBe(true);
    expect(isValidUrl('http://example.org')).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<b>',
    'ftp://example.org',
    'example.org',
    '',
    '/a',
  ])('rejects %j', (value) => {
    expect(isValidUrl(value)).toBe(false);
  });

  it('takes another allowlist', () => {
    expect(isValidUrl('mailto:a@example.org', ['mailto:'])).toBe(true);
    expect(isValidUrl('https://example.org', ['mailto:'])).toBe(false);
  });
});

describe('isRelativePath', () => {
  it('accepts same-origin paths', () => {
    expect(isRelativePath('/news')).toBe(true);
    expect(isRelativePath('/news/2026?page=2#top')).toBe(true);
    expect(isRelativePath('/')).toBe(true);
  });

  it.each([
    '//evil.com',
    'https://evil.com',
    '/\\evil.com',
    'news',
    '',
    // Browsers drop tabs and line breaks from a URL, which turns these into '//evil.com'.
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
  ])('rejects %j', (value) => {
    expect(isRelativePath(value)).toBe(false);
  });
});

describe('stripTrailingSlash', () => {
  it('strips every trailing slash and nothing else', () => {
    expect(stripTrailingSlash('/a//')).toBe('/a');
    expect(stripTrailingSlash('/a/b')).toBe('/a/b');
    expect(stripTrailingSlash('/a//b')).toBe('/a//b');
  });

  it('turns a root of slashes into the empty string', () => {
    expect(stripTrailingSlash('/')).toBe('');
    expect(stripTrailingSlash('///')).toBe('');
    expect(stripTrailingSlash('')).toBe('');
  });

  it('stays fast on a long run of slashes followed by something else', () => {
    const startedAt = performance.now();

    stripTrailingSlash(`${'/'.repeat(200_000)}x`);

    expect(performance.now() - startedAt).toBeLessThan(200);
  });
});

describe('joinPath', () => {
  it('joins with single slashes and ignores empty segments', () => {
    expect(joinPath('/a/', '/b', '', 'c/')).toBe('/a/b/c');
    expect(joinPath('a//', '//b')).toBe('/a/b');
  });

  it('returns the root for no segments', () => {
    expect(joinPath()).toBe('/');
    expect(joinPath('', '/', '//')).toBe('/');
  });
});

describe('buildQueryString', () => {
  it('builds a query with its leading ?', () => {
    expect(buildQueryString({ page: 2, q: 'a b' })).toBe('?page=2&q=a+b');
  });

  it('skips undefined and null, keeps false and 0', () => {
    expect(buildQueryString({ a: undefined, b: null, c: false, d: 0 })).toBe('?c=false&d=0');
  });

  it('repeats the key for an array', () => {
    expect(buildQueryString({ tag: ['a', 'b', 3] })).toBe('?tag=a&tag=b&tag=3');
  });

  it('encodes keys and values', () => {
    expect(buildQueryString({ 'a&b': 'c=d&e' })).toBe('?a%26b=c%3Dd%26e');
  });

  it('is empty when nothing remains', () => {
    expect(buildQueryString({})).toBe('');
    expect(buildQueryString({ a: undefined, b: [] })).toBe('');
  });
});
