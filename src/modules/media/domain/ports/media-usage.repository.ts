import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { MediaAssetId } from '../models/ids';

/**
 * Whether a website still uses a file: in a page being edited, or in ANY release (a rollback
 * restores an old release, so every one of them must keep resolving its files). Answering
 * "no" wrongly deletes something a published page shows, so an implementation errs towards "yes".
 */
export interface MediaUsageRepository {
  isReferenced(
    tenantId: TenantId,
    assetId: MediaAssetId,
  ): AppResultAsync<boolean, InfrastructureAppError>;
}
