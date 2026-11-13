import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { auditAccessDenied } from '../../domain/errors/audit-errors';
import {
  PLATFORM_AUDIT_SCOPE,
  websiteAuditScope,
  websitesAuditScope,
} from '../../domain/models/audit-scope';
import { parseWebsiteId, toWebsiteId } from '../../domain/models/ids';

import type { AuditScope } from '../../domain/models/audit-scope';
import type { WebsiteId } from '../../domain/models/ids';
import type { AuditAccessError, ReadableWebsites } from '../../domain/ports/audit-access.port';
import type { AuditReadDependencies } from '../audit-dependencies';

/**
 * Parses an untrusted website id from the request and verifies that the signed-in
 * reader holds `audit.read` in that website before any trail data is read.
 */
export function authorizeWebsiteId(
  deps: Pick<AuditReadDependencies, 'access'>,
  rawWebsiteId: string,
): AppResultAsync<WebsiteId, AuditAccessError> {
  return parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
    deps.access.authorizeWebsite(websiteId).map(() => websiteId),
  );
}

/**
 * The scope of a read across websites, from what the reader may read and the website the filter
 * names. A named website is not looked up in the reader's allowlist but authorized on its own, so
 * a reader whose allowlist was cut at its limit still reaches every website they may read, and
 * a forged id is refused exactly like a missing one. Without a named website the scope is the
 * platform's for a platform administrator and otherwise exactly the reader's own websites: it
 * never widens, and an empty allowlist is a refusal, not an empty read of everything.
 */
export function resolveAcrossWebsitesScope(
  deps: Pick<AuditReadDependencies, 'access'>,
  request: { readonly readable: ReadableWebsites; readonly rawWebsiteId: string | null },
): AppResultAsync<AuditScope, AuditAccessError> {
  const { readable, rawWebsiteId } = request;
  if (rawWebsiteId !== null) {
    return authorizeWebsiteId(deps, rawWebsiteId).map(websiteAuditScope);
  }
  if (readable.isPlatform) {
    return okAsync(PLATFORM_AUDIT_SCOPE);
  }
  const scope = websitesAuditScope(readable.websites.map((website) => toWebsiteId(website.id)));
  return scope === null ? errAsync(auditAccessDenied()) : okAsync(scope);
}
