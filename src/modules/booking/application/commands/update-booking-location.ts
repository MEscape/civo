import type { Actor } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { err, errAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import { deepEqual } from '@lib/utils';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
  locationImpactUnacknowledged,
  locationNotFound,
  locationStale,
  timeZoneLocked,
} from '../../domain/errors/booking-errors';
import { parseBookingLocationId } from '../../domain/models/ids';
import { parseInstant } from '../../domain/time/instant';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';
import { changedSections } from '../services/location-changes';
import { countFutureBookings, findNewlyAffected } from '../services/location-impact';
import { toLocationView } from '../services/location-views';
import { parseLocationInput } from '../services/parse-location-input';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { Instant } from '../../domain/time/instant';
import type { LocationAdminDependencies } from '../booking-dependencies';
import type { UpdateLocationInput } from '../contracts/location-inputs';
import type { LocationImpactView, LocationView } from '../contracts/location-views';
import type { ActorLimitError } from '../services/limit-actor';
import type { ParsedLocation } from '../services/parse-location-input';

export type UpdateBookingLocationError =
  | BookingAccessError
  | ActorLimitError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

function parseVersion(text: string): AppResult<Instant, ValidationAppError> {
  const version = parseInstant(text);
  return version === null
    ? err(fieldValidationFailed('expectedVersion', CODES.idInvalid))
    : ok(version);
}

/**
 * A manager changes a location. The change names the version it was made from, and is refused if the
 * location moved on (`booking.location_stale`); the time zone of a location with confirmed bookings
 * ahead cannot change (`booking.time_zone_locked`: each of them is a moment on that clock); and a
 * change of the hours that would leave existing bookings outside them is refused unless the manager
 * has seen which ones and lets them stand (`booking.location_impact_unacknowledged`). Nothing is ever
 * cancelled or moved by it, and no citizen is told: a booking left outside the hours simply stays,
 * and `findAffectedBookings` finds it again. Switching a location off touches no booking either.
 * Needs `booking.configure`.
 */
export class UpdateBookingLocation {
  constructor(private readonly deps: LocationAdminDependencies) {}

  execute(input: UpdateLocationInput): AppResultAsync<LocationView, UpdateBookingLocationError> {
    const { access, locations, clock } = this.deps;
    const now = currentInstant(clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return parseBookingLocationId(input.locationId)
          .andThen((id) =>
            parseLocationInput(input).andThen((next) =>
              parseVersion(input.expectedVersion).map((expected) => ({ id, next, expected })),
            ),
          )
          .asyncAndThen(({ id, next, expected }) =>
            locations
              .findById(scope, id)
              .andThen((current) =>
                current === null
                  ? errAsync(locationNotFound())
                  : this.change({ actor, scope, current, next, expected, now, input }),
              ),
          );
      });
  }

  private change(request: {
    readonly actor: Actor;
    readonly scope: BookingScope;
    readonly current: StoredLocation;
    readonly next: ParsedLocation;
    readonly expected: Instant;
    readonly now: Instant;
    readonly input: UpdateLocationInput;
  }): AppResultAsync<LocationView, UpdateBookingLocationError> {
    const { actor, scope, current, next, expected, now, input } = request;
    const { locations, audit } = this.deps;

    if (current.updatedAt !== expected) {
      return errAsync(locationStale());
    }
    const isZoneChanged = next.zone !== current.zone;
    const isHoursChanged = !deepEqual(next.openingHours, current.openingHours);

    const zoneGuard: AppResultAsync<void, ConflictAppError | InfrastructureAppError> = isZoneChanged
      ? countFutureBookings(this.deps, { scope, locationId: current.id, now }).andThen((count) =>
          count > 0 ? errAsync(timeZoneLocked()) : okAsync(undefined),
        )
      : okAsync(undefined);
    const impact: AppResultAsync<LocationImpactView, InfrastructureAppError> = isHoursChanged
      ? findNewlyAffected(this.deps, {
          scope,
          location: current,
          nextPlan: next.openingHours,
          nextZone: next.zone,
          now,
        })
      : okAsync({ affected: [], isTruncated: false });

    return zoneGuard
      .andThen(() => impact)
      .andThen((found) =>
        (found.affected.length > 0 || found.isTruncated) && !input.acknowledgeImpact
          ? errAsync(locationImpactUnacknowledged())
          : locations
              .save(scope, {
                stored: { ...next, id: current.id, updatedAt: current.updatedAt },
                expected,
                now,
              })
              .map((saved) => {
                audit.record({
                  type: 'booking.location_updated',
                  tenantId: scope.tenantId,
                  websiteId: scope.websiteId,
                  actorId: actor.id,
                  locationId: saved.id,
                  sections: changedSections(current, next, isHoursChanged),
                  leftOpen: found.affected.length,
                });
                return saved;
              }),
      )
      .andThen((saved) =>
        countFutureBookings(this.deps, { scope, locationId: saved.id, now }).map((count) =>
          toLocationView(saved, scope.websiteId, count),
        ),
      );
  }
}
