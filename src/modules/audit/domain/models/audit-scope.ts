import type { WebsiteId } from './ids';

/**
 * Whose entries a read covers. The trail of several websites is a different kind of read, not a
 * website that happens to be absent: with a `WebsiteId | null` parameter, a missing id (a lost
 * route parameter, a failed lookup) silently reads EVERY tenant's entries. A scope has to be named:
 * one website, an explicit allowlist the reader was authorized for, or the platform's, which
 * has a name no website id can take. The allowlist is never empty: an empty one would read nothing
 * and is refused where it is built, never widened.
 */
export type AuditScope =
  | { readonly kind: 'website'; readonly websiteId: WebsiteId }
  | { readonly kind: 'websites'; readonly websiteIds: readonly [WebsiteId, ...WebsiteId[]] }
  | { readonly kind: 'platform' };

export const PLATFORM_AUDIT_SCOPE: AuditScope = { kind: 'platform' };

export function websiteAuditScope(websiteId: WebsiteId): AuditScope {
  return { kind: 'website', websiteId };
}

/** The scope of an allowlist, or `null` for an empty one: nothing may be read, and nothing is widened to. */
export function websitesAuditScope(websiteIds: readonly WebsiteId[]): AuditScope | null {
  const [first, ...rest] = websiteIds;
  return first === undefined ? null : { kind: 'websites', websiteIds: [first, ...rest] };
}
