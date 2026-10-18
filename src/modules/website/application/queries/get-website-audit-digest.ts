import type { AuditDigestView } from '@modules/audit';

import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedWebsite } from '../load-authorized-website';

import type { AuditTrailReadError } from '../../domain/ports/audit-trail-reader.port';
import type { LoadWebsiteError } from '../load-authorized-website';
import type { WebsiteAuditDependencies } from '../website-dependencies';

/** The newest entries of a website's audit trail and the week's counts, for its overview. Needs `audit.read`. */
export class GetWebsiteAuditDigest {
  constructor(private readonly deps: WebsiteAuditDependencies) {}

  execute(
    websiteId: string,
  ): AppResultAsync<AuditDigestView, LoadWebsiteError | AuditTrailReadError> {
    return loadAuthorizedWebsite(this.deps, websiteId, 'audit.read').andThen(({ website }) =>
      this.deps.auditTrail.digest(website.id),
    );
  }
}
