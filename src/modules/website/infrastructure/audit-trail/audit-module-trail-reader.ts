import type {
  AuditDigestView,
  AuditFilter,
  AuditPageOptions,
  AuditTrailView,
} from '@modules/audit';

import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../../domain/models/ids';
import type {
  AuditTrailReadError,
  AuditTrailReader,
} from '../../domain/ports/audit-trail-reader.port';

/** The website module's ONLY dependency on the audit module, through its public queries. */
export class AuditModuleTrailReader implements AuditTrailReader {
  constructor(
    private readonly queries: {
      readonly getAuditTrail: {
        execute(
          websiteId: string,
          filter: AuditFilter,
          page: AuditPageOptions,
        ): AppResultAsync<AuditTrailView, AuditTrailReadError>;
      };
      readonly getAllWebsitesAuditTrail: {
        execute(
          filter: AuditFilter,
          page: AuditPageOptions,
        ): AppResultAsync<AuditTrailView, AuditTrailReadError>;
      };
      readonly getAuditDigest: {
        execute(websiteId: string): AppResultAsync<AuditDigestView, AuditTrailReadError>;
      };
    },
  ) {}

  read(websiteId: WebsiteId, filter: AuditFilter, page: AuditPageOptions) {
    return this.queries.getAuditTrail.execute(websiteId, filter, page);
  }

  readAcrossWebsites(filter: AuditFilter, page: AuditPageOptions) {
    return this.queries.getAllWebsitesAuditTrail.execute(filter, page);
  }

  digest(websiteId: WebsiteId) {
    return this.queries.getAuditDigest.execute(websiteId);
  }
}
