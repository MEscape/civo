import type {
  AuditDigestView,
  AuditFilter,
  AuditPageOptions,
  AuditTrailView,
} from '@modules/audit';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

export type AuditTrailReadError = ValidationAppError | InfrastructureAppError;

/**
 * Reads the audit trail of one website. The website module authorizes the
 * reader and hands over the id of the website it loaded; the adapter asks
 * the audit module, which keeps the trail of every module.
 */
export interface AuditTrailReader {
  /** `websiteId: null` reads the trail of every website. */
  read(
    websiteId: WebsiteId | null,
    filter: AuditFilter,
    page: AuditPageOptions,
  ): AppResultAsync<AuditTrailView, AuditTrailReadError>;

  digest(websiteId: WebsiteId): AppResultAsync<AuditDigestView, AuditTrailReadError>;
}
