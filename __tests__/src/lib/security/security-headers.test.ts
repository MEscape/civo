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
    expect(valueOf(headers, 'Content-Security-Policy')).toContain("frame-ancestors 'self'");
  });

  it('adds no script policy that could break pages without a nonce', () => {
    const csp = valueOf(securityHeaders({ isProduction: true }), 'Content-Security-Policy');
    expect(csp).not.toContain('script-src');
    expect(csp).not.toContain('default-src');
  });

  it('sends HSTS in production only', () => {
    expect(valueOf(securityHeaders({ isProduction: false }), 'Strict-Transport-Security')).toBe(
      undefined,
    );
    expect(valueOf(securityHeaders({ isProduction: true }), 'Strict-Transport-Security')).toContain(
      'max-age=63072000',
    );
  });
});
