import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';

import { securityHeaders } from './src/lib/security/security-headers';

const nextConfig: NextConfig = {
  ...(process.env['DOCKER_BUILD'] === 'true' ? { output: 'standalone' as const } : {}),
  reactCompiler: true,
  // Required by the one application cache (`'use cache'` in data-sources). Lifetimes are
  // declared where they are used, so there are no named cache-life profiles here.
  cacheComponents: true,
  // Recommended together with Cache Components: prefetch the static shell of a route, then stream the rest.
  partialPrefetching: true,
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: securityHeaders({ isProduction: process.env.NODE_ENV === 'production' }),
      },
      {
        // Single-use secrets travel in these URLs (`?token=`, or inside the sign-in `returnTo`), so no
        // referrer at all may leave the page. Every locale prefix matches; later rules override earlier ones.
        source: '/:locale/:page(accept-invitation|email-verified|sign-in|reset-password)/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ]),
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
