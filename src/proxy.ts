import { NextRequest, NextResponse } from 'next/server';

import createMiddleware from 'next-intl/middleware';

import { I18N_ROUTING } from '@i18n';

import { publicEnv } from '@lib/config';
import { serverEnv } from '@lib/config/server';
import { contentSecurityPolicy } from '@lib/security';
import { TENANT_HINT_HEADER, tenantHintFromPathname } from '@lib/tenancy';

const handleI18nRouting = createMiddleware(I18N_ROUTING);

/**
 * The page policy of this process. It names the storage endpoint, which only the running server
 * knows (a container build has a placeholder), so it is built here from the validated
 * configuration and not in `next.config.ts`. The configuration is fixed for the life of the
 * process, so it is built once.
 */
const CONTENT_SECURITY_POLICY = contentSecurityPolicy({
  isProduction: serverEnv.NODE_ENV === 'production',
  storageUrls: [serverEnv.STORAGE_S3_ENDPOINT, serverEnv.STORAGE_PUBLIC_BASE_URL],
  hasMap: publicEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN !== undefined,
});

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

// A named function keeps room to compose request-id logic around the i18n handler.
export function proxy(request: NextRequest): ReturnType<typeof handleI18nRouting> {
  const sanitized = withTenantHint(request);
  const response = NON_LOCALIZED.test(sanitized.nextUrl.pathname)
    ? NextResponse.next({ request: { headers: sanitized.headers } })
    : handleI18nRouting(sanitized);
  // Redirects carry it too, so every response of an address the proxy matches is covered.
  response.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  return response;
}

export const config = {
  // Skip Next internals and anything with a file extension (sitemap.xml, robots.txt, images):
  // none of them runs application code. API routes ARE matched, only to have the internal header cleaned.
  matcher: '/((?!_next|_vercel|.*\\..*).*)',
};
