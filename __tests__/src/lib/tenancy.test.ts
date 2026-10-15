import { describe, expect, it } from 'vitest';

import { tenantHintFromPathname } from '@lib/tenancy';

describe('tenantHintFromPathname', () => {
  it.each([
    ['/de/websites/abc-123', 'abc-123'],
    ['/en/websites/abc-123/builder/p1', 'abc-123'],
    ['/websites/abc_123/bookings', 'abc_123'],
  ])('names the website in %s', (pathname, expected) => {
    expect(tenantHintFromPathname(pathname)).toBe(expected);
  });

  it.each([
    '/de/websites',
    '/de/websites/',
    '/de/sign-in',
    '/s/town/websites/not-an-admin-address-is-still-read',
    '/de/websites/a%20b',
    `/de/websites/${'x'.repeat(65)}`,
  ])('names none in %s unless it is a website id', (pathname) => {
    const hint = tenantHintFromPathname(pathname);
    expect(hint === null || /^[A-Za-z0-9_-]{1,64}$/.test(hint)).toBe(true);
  });

  it('names none for the website list or a path outside the admin area', () => {
    expect(tenantHintFromPathname('/de/websites')).toBeNull();
    expect(tenantHintFromPathname('/de/sign-in')).toBeNull();
    expect(tenantHintFromPathname('/de/websites/a%20b')).toBeNull();
  });
});
