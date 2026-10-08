import type { NextRequest } from 'next/server';

import createMiddleware from 'next-intl/middleware';

import { I18N_ROUTING } from '@i18n';

const handleI18nRouting = createMiddleware(I18N_ROUTING);

// A named function keeps room to compose request-id / CSP-nonce logic around the i18n handler.
export function proxy(request: NextRequest): ReturnType<typeof handleI18nRouting> {
  return handleI18nRouting(request);
}

export const config = {
  // Skip API routes, Next internals and anything with a file extension (sitemap.xml, robots.txt, images).
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
