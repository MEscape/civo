import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { websiteNotFoundForBooking } from '../../domain/errors/booking-errors';
import { parseWebsiteId } from '../../domain/models/ids';

import type { WebsiteId } from '../../domain/models/ids';
import type { PublicBookingDependencies } from '../booking-dependencies';

export interface PublicScope {
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
}

export type PublicScopeError = ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The first step of every public booking use case: the website named in the
 * request, and the tenant that owns it according to the stored record. The
 * tenant is never taken from the request.
 */
export function resolvePublicScope(
  deps: Pick<PublicBookingDependencies, 'websites'>,
  rawWebsiteId: string,
): AppResultAsync<PublicScope, PublicScopeError> {
  return parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
    deps.websites
      .findTenantOf(websiteId)
      .andThen((tenantId): AppResultAsync<PublicScope, NotFoundAppError> =>
        tenantId === null
          ? errAsync(websiteNotFoundForBooking())
          : okAsync({ tenantId, websiteId }),
      ),
  );
}
