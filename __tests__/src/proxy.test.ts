import { NextRequest } from 'next/server';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxy } from '@/proxy';

const request = (path: string) => new NextRequest(`http://localhost:3000${path}`);

describe('proxy: Content-Security-Policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each(['/en/sign-in', '/api/health', '/en/websites'])('is on the response to %s', (path) => {
    const policy = proxy(request(path)).headers.get('Content-Security-Policy');

    expect(policy).toContain("frame-ancestors 'self'");
    expect(policy).toContain("connect-src 'self'");
  });

  it('names the storage the running server is configured with', () => {
    const policy = proxy(request('/api/health')).headers.get('Content-Security-Policy');

    // The test configuration points storage at http://localhost:8333.
    expect(policy).toContain('http://localhost:8333');
  });

  it('includes Mapbox origins in CSP only when external maps are enabled and tokenized', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', 'pk.test_token');
    vi.stubEnv('NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED', 'false');
    const disabled = (await import('@/proxy'))
      .proxy(request('/en/sign-in'))
      .headers.get('Content-Security-Policy');
    expect(disabled).not.toContain('https://api.mapbox.com');

    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', 'pk.test_token');
    vi.stubEnv('NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED', 'true');
    const enabled = (await import('@/proxy'))
      .proxy(request('/en/sign-in'))
      .headers.get('Content-Security-Policy');
    expect(enabled).toContain('https://api.mapbox.com');
    expect(enabled).toContain('https://*.tiles.mapbox.com');
    expect(enabled).toContain('https://events.mapbox.com');
  });

  it('is on a redirect too, such as the one that adds a missing locale', () => {
    const response = proxy(request('/'));

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get('Content-Security-Policy')).toContain("object-src 'none'");
  });
});
