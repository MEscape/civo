import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { websiteNotFound } from '../../domain/errors/booking-errors';
import { parseWebsiteId } from '../../domain/models/ids';

import type { BookingScope } from '../../domain/ports/booking.repository';
import type { BookingFlowDependencies } from '../booking-dependencies';

export type PublicScopeError = ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The first step of every public booking use case: the website named in the request, and the tenant
 * that owns it according to the stored record. The tenant is never taken from the request, so a
 * guessed website id reaches only that website's own, public, data.
 */
export function resolvePublicScope(
  deps: Pick<BookingFlowDependencies, 'websites'>,
  rawWebsiteId: string,
): AppResultAsync<BookingScope, PublicScopeError> {
  return parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
    deps.websites
      .findTenantOf(websiteId)
      .andThen((tenantId): AppResultAsync<BookingScope, NotFoundAppError> =>
        tenantId === null ? errAsync(websiteNotFound()) : okAsync({ tenantId, websiteId }),
      ),
  );
}
