import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';

import { checkServiceFeasibility } from './service-feasibility-check';

import type { FeasibilityScope } from './service-feasibility-check';
import type { BookableServiceDraft } from '../../domain/models/bookable-service';
import type { BookableServiceId } from '../../domain/models/ids';
import type { BookingDependencies } from '../booking-dependencies';

/**
 * A service that visitors can see must be able to work somewhere. An inactive
 * service is a draft and may name resources that do not exist yet; turning it
 * on is what needs at least one location where its requirements can be
 * filled (or will be, once employees offer it).
 */
export function requireBookableWhenActive(
  deps: Pick<BookingDependencies, 'locations' | 'resources'>,
  scope: FeasibilityScope,
  subject: { readonly draft: BookableServiceDraft; readonly serviceId: BookableServiceId | null },
): AppResultAsync<BookableServiceDraft, ValidationAppError | InfrastructureAppError> {
  const { draft, serviceId } = subject;
  if (!draft.isActive) {
    return okAsync(draft);
  }
  return checkServiceFeasibility(deps, scope, { id: serviceId, ...draft }).andThen((feasibility) =>
    feasibility.canBePublished
      ? okAsync(draft)
      : errAsync(fieldValidationFailed('isActive', BOOKING_VALIDATION_CODES.serviceNotBookable)),
  );
}
