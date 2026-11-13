import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { websiteAuditScope } from '../../domain/models/audit-scope';
import { readAuditTrail } from '../services/read-audit-trail';
import { authorizeWebsiteId } from '../services/resolve-across-websites-scope';

import type { AuditFilter } from '../../domain/models/audit-filter';
import type { AuditAccessError } from '../../domain/ports/audit-access.port';
import type { AuditReadDependencies } from '../audit-dependencies';
import type { AuditPageOptions, AuditTrailView } from '../contracts/audit-views';

/**
 * One page of ONE website's trail under a filter, newest first, with the counts per event type and
 * the members the filter can offer. The id comes from the address, so it is checked like any
 * other; the reader must hold `audit.read` in that website, decided from the reader's own
 * memberships before anything is read, and a stranger gets the same refusal as for a missing
 * website. A missing id is an error here, never every website (that is
 * `GetAuditTrailAcrossWebsites`), and the filter's website is ignored: the id names it.
 *
 * @authorization system Access is verified through the AuditAccess port before reading.
 */
export class GetAuditTrail {
  constructor(private readonly deps: AuditReadDependencies) {}

  execute(
    rawWebsiteId: string,
    filter: AuditFilter,
    options: AuditPageOptions = {},
  ): AppResultAsync<AuditTrailView, AuditAccessError | InfrastructureAppError> {
    return authorizeWebsiteId(this.deps, rawWebsiteId).andThen((websiteId) =>
      readAuditTrail(this.deps, { scope: websiteAuditScope(websiteId), filter, options }),
    );
  }
}
