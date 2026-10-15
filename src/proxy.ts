import { NextRequest } from 'next/server';

import createMiddleware from 'next-intl/middleware';

import { I18N_ROUTING } from '@i18n';

import { TENANT_HINT_HEADER, tenantHintFromPathname } from '@lib/tenancy';

const handleI18nRouting = createMiddleware(I18N_ROUTING);

/**
 * Names the website an admin address is about for the code behind it. The
 * header is always rewritten from the address, so a value the client sent is
 * never seen. It decides nothing here: only a platform administrator is
 * resolved by it, and every use case still authorizes (route-protection.md).
 */
function withTenantHint(request: NextRequest): NextRequest {
  const headers = new Headers(request.headers);
  const hint = tenantHintFromPathname(request.nextUrl.pathname);
  if (hint === null) {
    headers.delete(TENANT_HINT_HEADER);
  } else {
    headers.set(TENANT_HINT_HEADER, hint);
  }
  return new NextRequest(request, { headers });
}

// A named function keeps room to compose request-id / CSP-nonce logic around the i18n handler.
export function proxy(request: NextRequest): ReturnType<typeof handleI18nRouting> {
  return handleI18nRouting(withTenantHint(request));
}

export const config = {
  // Skip API routes, Next internals and anything with a file extension (sitemap.xml, robots.txt, images).
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
