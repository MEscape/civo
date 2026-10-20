import { NextRequest, NextResponse } from 'next/server';

import createMiddleware from 'next-intl/middleware';

import { I18N_ROUTING } from '@i18n';

import { TENANT_HINT_HEADER, tenantHintFromPathname } from '@lib/tenancy';

const handleI18nRouting = createMiddleware(I18N_ROUTING);

/** Addresses with no locale: the routes behind them are not pages, so locale routing must not touch them. */
const NON_LOCALIZED = /^\/(?:api|trpc)(?:\/|$)/;

/**
 * The request as the code behind the proxy must see it: the website the address names in
 * `x-civo-tenant`, and nothing else in that header. The header is internal, so it is rewritten
 * from the address on EVERY request that reaches the application, API routes included, and a
 * value the client sent is never seen anywhere. It selects and never grants: only a platform
 * administrator is moved by it, and every use case still authorizes (route-protection.md).
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
  const sanitized = withTenantHint(request);
  return NON_LOCALIZED.test(sanitized.nextUrl.pathname)
    ? NextResponse.next({ request: { headers: sanitized.headers } })
    : handleI18nRouting(sanitized);
}

export const config = {
  // Skip Next internals and anything with a file extension (sitemap.xml, robots.txt, images):
  // none of them runs application code. API routes ARE matched, only to have the internal header cleaned.
  matcher: '/((?!_next|_vercel|.*\\..*).*)',
};
