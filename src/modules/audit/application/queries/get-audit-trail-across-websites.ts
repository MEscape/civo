import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { readAuditTrail } from '../services/read-audit-trail';
import { resolveAcrossWebsitesScope } from '../services/resolve-across-websites-scope';

import type { AuditFilter } from '../../domain/models/audit-filter';
import type { AuditAccessError } from '../../domain/ports/audit-access.port';
import type { AuditReadDependencies } from '../audit-dependencies';
import type { AuditAcrossWebsitesView, AuditPageOptions } from '../contracts/audit-views';

/**
 * One page of the trail across websites under a filter, newest first. What it covers is decided
 * from the reader's authorization, never from the request: a platform administrator reads every
 * website, anyone else only the websites they hold `audit.read` in (an explicit allowlist,
 * applied before the counts and the page), and a reader with none is refused. The filter may
 * narrow it to one website, which is authorized on its own. The view says which reach applied, and
 * whether the reader's own list of websites was cut at its limit, so a partial trail is never
 * shown as the whole.
 *
 * @authorization system Accessible websites are resolved through the AuditAccess port before reading.
 */
export class GetAuditTrailAcrossWebsites {
  constructor(private readonly deps: AuditReadDependencies) {}

  execute(
    filter: AuditFilter,
    options: AuditPageOptions = {},
  ): AppResultAsync<AuditAcrossWebsitesView, AuditAccessError | InfrastructureAppError> {
    return this.deps.access.listReadableWebsites().andThen((readable) =>
      resolveAcrossWebsitesScope(this.deps, { readable, rawWebsiteId: filter.websiteId })
        .andThen((scope) => readAuditTrail(this.deps, { scope, filter, options }))
        .map((trail) => ({
          ...trail,
          reach: readable.isPlatform ? ('platform' as const) : ('websites' as const),
          websites: readable.websites,
          isWebsitesTruncated: readable.isTruncated,
        })),
    );
  }
}
