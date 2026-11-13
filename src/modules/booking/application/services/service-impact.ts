import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { fieldValidationFailed } from '../../domain/errors/booking-errors';
import { DEACTIVATION_SCOPES, BOOKING_VALIDATION_CODES } from '../contracts/booking-constraints';

import { listFutureServiceBookings, toServiceBookingView } from './service-bookings';
import { loadLocationZones } from './service-names';

import type { BookingLocationId } from '../../domain/models/ids';
import type { StoredService } from '../../domain/models/stored-service';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { DeactivationScope } from '../contracts/booking-constraints';
import type { DeactivationImpactView } from '../contracts/service-views';

/** `location` or `all`; anything else is refused at the field. */
export function parseScope(raw: string): AppResult<DeactivationScope, ValidationAppError> {
  const scope = DEACTIVATION_SCOPES.find((candidate) => candidate === raw);
  return scope === undefined
    ? err(fieldValidationFailed('scope', BOOKING_VALIDATION_CODES.idInvalid))
    : ok(scope);
}

/** The bookings closing a service reaches, with what the view of them needs. */
export interface ServiceImpact {
  readonly stored: readonly StoredBooking[];
  readonly isTruncated: boolean;
  readonly view: DeactivationImpactView;
}

/**
 * The confirmed bookings ahead that closing a service reaches: those at this location, or at every
 * location that has the service. Nothing is changed and nothing is decided here; the use cases that
 * close a service ask this first and decide from the answer.
 */
export function findServiceImpact(
  deps: ServiceAdminDependencies,
  request: {
    readonly scope: BookingScope;
    readonly service: StoredService;
    readonly locationId: BookingLocationId;
    readonly closing: DeactivationScope;
    readonly now: Instant;
  },
): AppResultAsync<ServiceImpact, InfrastructureAppError> {
  const { scope, service, locationId, closing, now } = request;
  return listFutureServiceBookings(deps, {
    scope,
    serviceId: service.id,
    ...(closing === 'location' ? { locationId } : {}),
    now,
  }).andThen(({ stored, isTruncated }) =>
    loadLocationZones(deps, scope).map((zones) => ({
      stored,
      isTruncated,
      view: {
        scope: closing,
        locationCount: closing === 'location' ? 1 : service.locations.length,
        futureBookingCount: stored.length,
        bookings: stored.flatMap((booking) => {
          const zone = zones.get(booking.booking.locationId);
          return zone === undefined ? [] : [toServiceBookingView(booking, zone)];
        }),
        isTruncated,
      },
    })),
  );
}
