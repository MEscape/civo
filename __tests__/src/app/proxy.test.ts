import { NextRequest } from 'next/server';

import { describe, expect, it, vi } from 'vitest';

import { proxy } from '@/proxy';

const seen = vi.hoisted(() => ({ request: null as unknown as Request }));

vi.mock('next-intl/middleware', () => ({
  default: () => (request: Request) => {
    seen.request = request;
    return new Response(null);
  },
}));
vi.mock('@i18n', () => ({ I18N_ROUTING: {} }));

const call = (url: string, headers: Record<string, string> = {}) => {
  proxy(new NextRequest(url, { headers }));
  return seen.request.headers.get('x-civo-tenant');
};

describe('proxy', () => {
  it('names the website an admin address is about', () => {
    expect(call('http://localhost:3000/de/websites/site-1/bookings')).toBe('site-1');
  });

  it('names none for the website list or a public address', () => {
    expect(call('http://localhost:3000/de/websites')).toBeNull();
    expect(call('http://localhost:3000/de/s/town')).toBeNull();
  });

  it('overwrites what the client sent, and removes it where no website is named', () => {
    expect(call('http://localhost:3000/de/websites/site-1', { 'x-civo-tenant': 'victim' })).toBe(
      'site-1',
    );
    expect(call('http://localhost:3000/de/websites', { 'x-civo-tenant': 'victim' })).toBeNull();
    expect(call('http://localhost:3000/de/sign-in', { 'x-civo-tenant': 'victim' })).toBeNull();
  });
});
