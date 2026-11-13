import type { Actor } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { serviceStale } from '../../domain/errors/booking-errors';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { announce } from '../services/announce';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { cancellationsFor } from '../services/closing-resolutions';
import { withinActorLimit } from '../services/limit-actor';
import { loadServiceAtLocation } from '../services/load-service-at-location';
import { loadServiceView } from '../services/load-service-view';
import { parseClosing } from '../services/parse-closing';
import { findServiceImpact } from '../services/service-impact';
import { loadLocationsById } from '../services/service-names';

import type { ServiceLocationSetting } from '../../domain/models/service-location';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingChange, BookingScope } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { DeactivateServiceInput } from '../contracts/service-inputs';
import type { ServiceView } from '../contracts/service-views';
import type { ActorLimitError } from '../services/limit-actor';
import type { ServiceAtLocation } from '../services/load-service-at-location';
import type { Closing } from '../services/parse-closing';

export type DeactivateServiceError =
  | BookingAccessError
  | ActorLimitError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

/**
 * A manager switches a service off, at one location or at every location that has it. Either only
 * new bookings are stopped, and every booking that exists stays valid, or the bookings it reaches
 * are reviewed first: each needs a decision, to leave it or to cancel it, and the closing is refused
 * while any is undecided. Nothing is cancelled that the manager did not choose, and the bookings
 * chosen end in the same transaction as the closing, so the service is never off with some of them
 * left standing nor some cancelled while it is still on. The people whose booking was cancelled are
 * told after the change committed. Needs `booking.configure`.
 */
export class DeactivateService {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(input: DeactivateServiceInput): AppResultAsync<ServiceView, DeactivateServiceError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return parseClosing(input).asyncAndThen((closing) =>
          loadServiceAtLocation(this.deps, scope, input).andThen((found) =>
            this.close({ actor, scope, found, closing, now }),
          ),
        );
      });
  }

  private close(request: {
    readonly actor: Actor;
    readonly scope: BookingScope;
    readonly found: ServiceAtLocation;
    readonly closing: Closing;
    readonly now: Instant;
  }): AppResultAsync<ServiceView, DeactivateServiceError> {
    const { actor, scope, found, closing, now } = request;
    const { service, location, setting } = found;
    const isAll = closing.scope === 'all';
    const isStale = isAll
      ? service.updatedAt !== closing.version
      : setting.updatedAt !== closing.settingVersion;
    if (isStale) {
      return errAsync(serviceStale());
    }

    return this.decide(request).andThen(({ changes, leftOpen }) =>
      this.deps.services
        .save(scope, {
          service: isAll
            ? { stored: { ...service, isActive: false }, expected: closing.version }
            : null,
          setting: isAll
            ? null
            : {
                serviceId: service.id,
                stored: { ...withoutVersion(setting), isActive: false },
                expected: closing.settingVersion,
              },
          cancellations: changes,
          now,
        })
        .andThen((saved) =>
          loadLocationsById(this.deps, scope).andThen((locations) => {
            this.deps.audit.record({
              type: 'booking.service_deactivated',
              tenantId: scope.tenantId,
              websiteId: scope.websiteId,
              actorId: actor.id,
              serviceId: saved.id,
              locationId: location.id,
              scope: closing.scope,
              cancelled: changes.length,
              leftOpen,
            });
            for (const change of changes) {
              const place = locations.get(change.stored.booking.locationId);
              if (place !== undefined) {
                announce(this.deps, {
                  kind: 'cancelled',
                  stored: { ...change.stored, tenantId: scope.tenantId },
                  location: place,
                  websiteId: scope.websiteId,
                });
              }
            }
            const savedSetting = saved.locations.find((part) => part.locationId === location.id);
            return savedSetting === undefined
              ? errAsync(serviceStale())
              : loadServiceView(this.deps, {
                  scope,
                  found: { service: saved, location, setting: savedSetting },
                  now,
                });
          }),
        ),
    );
  }

  /** The bookings that end with the closing: none for "only stop new bookings", the chosen ones for a review. */
  private decide(request: {
    readonly scope: BookingScope;
    readonly found: ServiceAtLocation;
    readonly closing: Closing;
    readonly now: Instant;
  }): AppResultAsync<
    { readonly changes: readonly BookingChange[]; readonly leftOpen: number },
    DeactivateServiceError
  > {
    const { scope, found, closing, now } = request;
    if (closing.mode === 'block-new') {
      return okAsync({ changes: [], leftOpen: 0 });
    }
    const { service, location } = found;
    return findServiceImpact(this.deps, {
      scope,
      service,
      locationId: location.id,
      closing: closing.scope,
      now,
    }).andThen(({ stored, isTruncated }) =>
      cancellationsFor({
        service,
        bookings: stored,
        isTruncated,
        decided: closing.decided,
        now,
      }).asyncAndThen((value) => okAsync(value)),
    );
  }
}

/** A location's part without its version. */
function withoutVersion(setting: ServiceAtLocation['setting']): ServiceLocationSetting {
  return {
    locationId: setting.locationId,
    isActive: setting.isActive,
    isOnlineBookable: setting.isOnlineBookable,
    resources: setting.resources,
  };
}
