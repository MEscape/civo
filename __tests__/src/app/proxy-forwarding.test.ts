import { NextRequest } from 'next/server';

import { describe, expect, it } from 'vitest';

import { proxy } from '@/proxy';

/**
 * With the real i18n middleware (not a stand-in): the header must reach the
 * code behind the proxy, which reads it as a request header. Next forwards the
 * request headers a middleware sets as `x-middleware-request-*`.
 */
const forwarded = (url: string, headers: Record<string, string> = {}) =>
  proxy(new NextRequest(url, { headers })).headers.get('x-middleware-request-x-civo-tenant');

describe('proxy with the i18n middleware', () => {
  it('forwards the website an admin address names', () => {
    expect(
      forwarded('http://localhost:3000/de/websites/3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59/bookings'),
    ).toBe('3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59');
  });

  it('forwards nothing for the list, and nothing a client invented', () => {
    expect(forwarded('http://localhost:3000/de/websites')).toBeNull();
    expect(
      forwarded('http://localhost:3000/de/websites', { 'x-civo-tenant': 'victim' }),
    ).toBeNull();
  });

  it('forwards the address, not what the client claimed', () => {
    expect(
      forwarded('http://localhost:3000/de/websites/3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59', {
        'x-civo-tenant': 'victim',
      }),
    ).toBe('3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59');
  });
});

describe('proxy on routes that are not pages', () => {
  const respond = (url: string, headers: Record<string, string> = {}) =>
    proxy(new NextRequest(url, { headers }));

  it.each(['/api/auth/get-session', '/api/health', '/trpc/anything'])(
    'removes an x-civo-tenant a client sent to %s, so no route can ever read one',
    (path) => {
      const response = respond(`http://localhost:3000${path}`, { 'x-civo-tenant': 'victim' });

      expect(response.headers.get('x-middleware-request-x-civo-tenant')).toBeNull();
      expect(response.headers.get('x-middleware-override-headers') ?? '').not.toContain(
        'x-civo-tenant',
      );
    },
  );

  it('leaves the other request headers of an API call as they were', () => {
    const response = respond('http://localhost:3000/api/auth/get-session', {
      'x-request-id': 'abc',
      'x-civo-tenant': 'victim',
    });

    expect(response.headers.get('x-middleware-override-headers')).toContain('x-request-id');
  });

  it('does not run locale routing on them: no redirect to a locale', () => {
    const response = respond('http://localhost:3000/api/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('the proxy matcher', () => {
  it('covers API routes, to clean the header, and skips Next internals and files', async () => {
    const { config } = await import('@/proxy');
    const matcher = new RegExp(`^${config.matcher}$`);

    expect(matcher.test('/api/auth/get-session')).toBe(true);
    expect(matcher.test('/de/websites')).toBe(true);
    expect(matcher.test('/_next/static/chunk.js')).toBe(false);
    expect(matcher.test('/robots.txt')).toBe(false);
  });
});
