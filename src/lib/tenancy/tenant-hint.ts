/**
 * The request header that carries the website a request is about. `proxy.ts`
 * sets it from the address and overwrites whatever the client sent, so it is
 * never a claim of the caller: it names the tenant a platform administrator
 * is working in. A tenant's own members are resolved from their memberships
 * and ignore it.
 */
export const TENANT_HINT_HEADER = 'x-civo-tenant';

/** A website id: letters, digits, `-` and `_`, as long as an identifier. */
const WEBSITE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The website an admin address names (`/<locale>/websites/<id>/...`), or
 * `null`. A tenant is its website, so this is also the tenant.
 */
export function tenantHintFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter((segment) => segment !== '');
  const at = segments.indexOf('websites');
  const candidate = at === -1 ? undefined : segments[at + 1];
  return candidate !== undefined && WEBSITE_SEGMENT.test(candidate) ? candidate : null;
}
