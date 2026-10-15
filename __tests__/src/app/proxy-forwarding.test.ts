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
    expect(forwarded('http://localhost:3000/de/websites/site-1/bookings')).toBe('site-1');
  });

  it('forwards nothing for the list, and nothing a client invented', () => {
    expect(forwarded('http://localhost:3000/de/websites')).toBeNull();
    expect(
      forwarded('http://localhost:3000/de/websites', { 'x-civo-tenant': 'victim' }),
    ).toBeNull();
  });

  it('forwards the address, not what the client claimed', () => {
    expect(
      forwarded('http://localhost:3000/de/websites/site-1', { 'x-civo-tenant': 'victim' }),
    ).toBe('site-1');
  });
});
