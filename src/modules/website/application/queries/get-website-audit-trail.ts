import type { AuditFilter, AuditPageOptions, AuditTrailView } from '@modules/audit';

import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedWebsite } from '../load-authorized-website';

import type { AuditTrailReadError } from '../../domain/ports/audit-trail-reader.port';
import type { LoadWebsiteError } from '../load-authorized-website';
import type { WebsiteAuditDependencies } from '../website-dependencies';

/** What was done to a website, by whom, under a filter: one page of its audit trail. Needs `audit.read`. */
export class GetWebsiteAuditTrail {
  constructor(private readonly deps: WebsiteAuditDependencies) {}

  execute(
    websiteId: string,
    filter: AuditFilter,
    page: AuditPageOptions = {},
  ): AppResultAsync<AuditTrailView, LoadWebsiteError | AuditTrailReadError> {
    return loadAuthorizedWebsite(this.deps, websiteId, 'audit.read').andThen(({ website }) =>
      this.deps.auditTrail.read(website.id, filter, page),
    );
  }
}
