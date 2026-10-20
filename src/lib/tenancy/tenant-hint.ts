/**
 * The request header that carries the website a request is about.
 *
 * Server code cannot see the address of the page it renders, and the actor is resolved far from
 * the route, so `proxy.ts` (the one place that sees every address) copies the website out of the
 * path into this header. It is a SELECTOR, never a credential: the proxy overwrites whatever the
 * client sent, a platform administrator, who may work in any website anyway, is the only one it
 * moves, and a member is moved only to a website they already belong to. Every use case still
 * authorizes against the server-side session (route-protection.md).
 */
export const TENANT_HINT_HEADER = 'x-civo-tenant';

const WEBSITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a value has the shape of a website id. A website is issued a UUID, as `randomUUID()` and
 * the database default both produce, and a website is its tenant. Requiring that exact shape, not
 * "any token", is what keeps the platform's own screens (`/websites/users`, `/websites/audit`) and
 * the reserved scopes (`platform`, `unassigned`) from being read as a website. Both ends of the
 * header use it: the proxy that writes it and the actor provider that reads it.
 */
export function isWebsiteId(value: string): boolean {
  return WEBSITE_ID.test(value);
}

/**
 * The website an admin address names (`/<locale>/websites/<id>/...`), or `null`. The path must be
 * exactly that shape: the locale first, then `websites`, then a website id. The list
 * (`/websites`), the platform screens beside it and every other address, such as a published
 * site that happens to have a page called "websites", name no website.
 *
 * Keep this in step with `websiteRoutes` (`modules/website`); a test walks that table.
 */
export function tenantHintFromPathname(pathname: string): string | null {
  const [, section, candidate] = pathname.split('/').filter((segment) => segment !== '');
  return section === 'websites' && candidate !== undefined && isWebsiteId(candidate)
    ? candidate
    : null;
}
