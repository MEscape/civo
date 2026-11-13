/** One response header, in the shape `next.config.ts` takes. */
export interface SecurityHeader {
  readonly key: string;
  readonly value: string;
}

const HSTS_MAX_AGE_SECONDS = 63_072_000;

/**
 * Browser features no page of this site uses. Switching them off for the site and for anything it
 * embeds means an injected script cannot ask for them either. Features the site does use
 * (fullscreen, for one) are left at the browser's default.
 */
const DISABLED_FEATURES = [
  'accelerometer',
  'bluetooth',
  'browsing-topics',
  'camera',
  'display-capture',
  'geolocation',
  'gyroscope',
  'hid',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'serial',
  'usb',
] as const;

const PERMISSIONS_POLICY = DISABLED_FEATURES.map((feature) => `${feature}=()`).join(', ');

/**
 * The headers every response carries (security.md), fixed when the app is built. The page's
 * Content-Security-Policy is not among them: it names hosts only known at runtime, so
 * `proxy.ts` builds it (`contentSecurityPolicy`). `Referrer-Policy` keeps a path and query, such
 * as an emailed single-use link, from leaving the site; HSTS is sent in production only, where
 * the site is served over HTTPS.
 */
export function securityHeaders(options: { readonly isProduction: boolean }): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Older browsers ignore the policy's `frame-ancestors`; this says the same thing to them.
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    // A window another site opened, or that this site opens to another, shares no browsing context
    // with it, so neither can reach the other through `window.opener`.
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    // No Flash or PDF policy file may grant another site this one's data.
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  ];
  if (options.isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
    });
  }
  return headers;
}
