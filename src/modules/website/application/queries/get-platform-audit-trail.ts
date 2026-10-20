import type { AuditFilter, AuditPageOptions, AuditTrailView } from '@modules/audit';
import type { AuthorizationError } from '@modules/auth';

import type { AppResultAsync } from '@lib/result';

import type { AuditTrailReadError } from '../../domain/ports/audit-trail-reader.port';
import type { WebsiteAuditDependencies } from '../website-dependencies';

/**
 * What was done across every website, by whom, under a filter: one page of the
 * platform-wide audit trail, optionally narrowed to one website by the filter.
 * For those who may list all websites, that is, the platform's administrators.
 */
export class GetPlatformAuditTrail {
  constructor(private readonly deps: WebsiteAuditDependencies) {}

  execute(
    filter: AuditFilter,
    page: AuditPageOptions = {},
  ): AppResultAsync<AuditTrailView, AuthorizationError | AuditTrailReadError> {
    return this.deps.authorization
      .requireInTenant('website.list.all')
      .andThen(() => this.deps.auditTrail.readAcrossWebsites(filter, page));
  }
}
