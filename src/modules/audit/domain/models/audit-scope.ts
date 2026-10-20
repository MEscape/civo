import type { WebsiteId } from './ids';

/**
 * Whose entries a read covers. The trail of every website is a different kind of read, not a
 * website that happens to be absent: with a `WebsiteId | null` parameter, a missing id (a lost
 * route parameter, a failed lookup) silently reads EVERY tenant's entries. A scope has to be named,
 * and the platform scope has a name no website id can take.
 */
export type AuditScope =
  { readonly kind: 'website'; readonly websiteId: WebsiteId } | { readonly kind: 'platform' };

export const PLATFORM_AUDIT_SCOPE: AuditScope = { kind: 'platform' };

export function websiteAuditScope(websiteId: WebsiteId): AuditScope {
  return { kind: 'website', websiteId };
}
