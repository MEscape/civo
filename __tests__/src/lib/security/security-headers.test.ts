import { describe, expect, it } from 'vitest';

import { securityHeaders } from '@lib/security';

function valueOf(headers: ReturnType<typeof securityHeaders>, key: string): string | undefined {
  return headers.find((header) => header.key === key)?.value;
}

describe('securityHeaders', () => {
  it('always forbids sniffing, framing by other sites and leaking paths cross-origin', () => {
    const headers = securityHeaders({ isProduction: false });
    expect(valueOf(headers, 'X-Content-Type-Options')).toBe('nosniff');
    expect(valueOf(headers, 'X-Frame-Options')).toBe('SAMEORIGIN');
    expect(valueOf(headers, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('leaves the page policy to the proxy, which knows the hosts only the running server does', () => {
    for (const isProduction of [false, true]) {
      expect(valueOf(securityHeaders({ isProduction }), 'Content-Security-Policy')).toBeUndefined();
    }
  });

  it('sends HSTS in production only', () => {
    expect(valueOf(securityHeaders({ isProduction: false }), 'Strict-Transport-Security')).toBe(
      undefined,
    );
    expect(valueOf(securityHeaders({ isProduction: true }), 'Strict-Transport-Security')).toContain(
      'max-age=63072000',
    );
  });

  it('switches off the browser features no page uses, and keeps the ones the site needs', () => {
    const policy = valueOf(securityHeaders({ isProduction: false }), 'Permissions-Policy') ?? '';
    for (const feature of [
      'camera',
      'microphone',
      'geolocation',
      'payment',
      'usb',
      'browsing-topics',
    ]) {
      expect(policy).toContain(`${feature}=()`);
    }
    expect(policy).not.toContain('fullscreen');
    expect(policy).not.toContain('clipboard');
  });

  it('isolates the browsing context and refuses cross-domain policy files', () => {
    const headers = securityHeaders({ isProduction: false });
    expect(valueOf(headers, 'Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(valueOf(headers, 'X-Permitted-Cross-Domain-Policies')).toBe('none');
  });

  it('never repeats a header', () => {
    const keys = securityHeaders({ isProduction: true }).map((header) => header.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
