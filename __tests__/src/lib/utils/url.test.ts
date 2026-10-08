import { describe, expect, it } from 'vitest';

import {
  buildQueryString,
  ensureTrailingSlash,
  isRelativePath,
  isValidUrl,
  joinPath,
  stripTrailingSlash,
} from '@lib/utils/url';

describe('isValidUrl', () => {
  it('accepts http and https by default', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/a?b=1')).toBe(true);
  });

  it('rejects other protocols and garbage', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('honors a custom protocol allowlist', () => {
    expect(isValidUrl('mailto:a@b.de', ['mailto:'])).toBe(true);
  });
});

describe('isRelativePath', () => {
  it('accepts same-origin paths', () => {
    expect(isRelativePath('/news')).toBe(true);
  });

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'news'])('rejects %s', (value) => {
    expect(isRelativePath(value)).toBe(false);
  });
});

describe('trailing slash helpers', () => {
  it('ensures exactly one trailing slash', () => {
    expect(ensureTrailingSlash('/a')).toBe('/a/');
    expect(ensureTrailingSlash('/a///')).toBe('/a/');
  });

  it('strips trailing slashes', () => {
    expect(stripTrailingSlash('/a//')).toBe('/a');
  });
});

describe('joinPath', () => {
  it('joins with single slashes and ignores empty segments', () => {
    expect(joinPath('/a/', '/b', '', 'c/')).toBe('/a/b/c');
  });

  it('returns the root for no segments', () => {
    expect(joinPath()).toBe('/');
  });
});

describe('buildQueryString', () => {
  it('skips null and undefined and repeats array keys', () => {
    expect(buildQueryString({ a: 1, b: undefined, c: null, d: ['x', 'y'] })).toBe('?a=1&d=x&d=y');
  });

  it('returns an empty string when no params remain', () => {
    expect(buildQueryString({ a: undefined })).toBe('');
  });

  it('stringifies booleans and numbers', () => {
    expect(buildQueryString({ active: true, count: 0 })).toBe('?active=true&count=0');
  });
});
