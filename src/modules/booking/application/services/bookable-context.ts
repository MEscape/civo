import type { TenantId } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { err, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  locationNotFound,
  locationUnavailable,
  serviceInactive,
  serviceNotFound,
} from '../../domain/errors/booking-errors';
import { parseBookableServiceId, parseBookingLocationId } from '../../domain/models/ids';

import type { BookableService } from '../../domain/models/bookable-service';
import type { BookingLocation } from '../../domain/models/booking-location';
import type { WebsiteId } from '../../domain/models/ids';
import type { PublicBookingDependencies } from '../booking-dependencies';

export type BookableContextError =
  ValidationAppError | NotFoundAppError | ConflictAppError | InfrastructureAppError;

export interface BookableContext {
  readonly service: BookableService;
  readonly location: BookingLocation;
}

type ContextDependencies = Pick<PublicBookingDependencies, 'services' | 'locations'>;

function requireBookable(
  service: BookableService | null,
  location: BookingLocation | null,
  websiteId: WebsiteId,
): AppResult<BookableContext, NotFoundAppError | ConflictAppError> {
  // Both were loaded by tenant; the website must match too, or an id from a sibling site would work here.
  if (service?.websiteId !== websiteId) {
    return err(serviceNotFound());
  }
  if (location?.websiteId !== websiteId) {
    return err(locationNotFound());
  }
  if (!service.isActive) {
    return err(serviceInactive());
  }
  if (!location.isActive || !service.locationIds.includes(location.id)) {
    return err(locationUnavailable());
  }
  return ok({ service, location });
}

/**
 * The service and location a visitor chose, checked to exist in the website,
 * to be bookable now, and to belong together.
 */
export function loadBookableContext(
  deps: ContextDependencies,
  scope: { readonly tenantId: TenantId; readonly websiteId: WebsiteId },
  choice: { readonly serviceId: string; readonly locationId: string },
): AppResultAsync<BookableContext, BookableContextError> {
  return parseBookableServiceId(choice.serviceId).asyncAndThen((serviceId) =>
    parseBookingLocationId(choice.locationId).asyncAndThen((locationId) =>
      deps.services
        .findById(serviceId, scope.tenantId)
        .andThen((service) =>
          deps.locations
            .findById(locationId, scope.tenantId)
            .andThen((location) =>
              requireBookable(service, location, scope.websiteId).asyncAndThen((context) =>
                okAsync(context),
              ),
            ),
        ),
    ),
  );
}
