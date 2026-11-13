import type { Actor } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { deepEqual } from '@lib/utils';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
  serviceSharedUnacknowledged,
  serviceStale,
} from '../../domain/errors/booking-errors';
import { isSharedElsewhere } from '../../domain/models/service-origin';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';
import { loadServiceAtLocation } from '../services/load-service-at-location';
import { loadServiceView } from '../services/load-service-view';
import { parseServiceInput } from '../services/parse-service-input';
import { parseVersion } from '../services/parse-version';
import { baseOf, changesSharedPart, definitionOf } from '../services/service-definition';
import { linksFor, loadResourcesServing } from '../services/service-resources';

import type { ServiceLocationSetting } from '../../domain/models/service-location';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { UpdateServiceInput } from '../contracts/service-inputs';
import type { ServiceView } from '../contracts/service-views';
import type { ActorLimitError } from '../services/limit-actor';
import type { ServiceAtLocation } from '../services/load-service-at-location';
import type { ParsedService } from '../services/parse-service-input';

export type UpdateBookableServiceError =
  | BookingAccessError
  | ActorLimitError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

/**
 * A manager changes a service at a location. The service has two parts, and the change names the
 * version of each it was made from: the shared definition (everywhere the service is on) and this
 * location's part (whether it runs here, takes online bookings, and which resources it uses). Either
 * is refused if it moved on (`booking.service_stale`). A change to the shared definition of a service
 * that other locations have on reaches them too, so it is refused unless the manager has said they
 * know (`booking.service_shared_unacknowledged`). Bookings that exist keep what they were made with:
 * their length, buffers and requirements are stored with them, so nothing here moves or cancels one.
 * Needs `booking.configure`.
 */
export class UpdateBookableService {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(input: UpdateServiceInput): AppResultAsync<ServiceView, UpdateBookableServiceError> {
    const { access, clock } = this.deps;
    const now = currentInstant(clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return parseServiceInput(input)
          .andThen((parsed) =>
            parseVersion('expectedVersion', input.expectedVersion).andThen((version) =>
              parseVersion('expectedSettingVersion', input.expectedSettingVersion).map(
                (settingVersion) => ({ parsed, version, settingVersion }),
              ),
            ),
          )
          .asyncAndThen((request) =>
            loadServiceAtLocation(this.deps, scope, input).andThen((found) =>
              this.change({ actor, scope, found, now, input, ...request }),
            ),
          );
      });
  }

  private change(request: {
    readonly actor: Actor;
    readonly scope: BookingScope;
    readonly found: ServiceAtLocation;
    readonly now: Instant;
    readonly input: UpdateServiceInput;
    readonly parsed: ParsedService;
    readonly version: Instant;
    readonly settingVersion: Instant;
  }): AppResultAsync<ServiceView, UpdateBookableServiceError> {
    const { actor, scope, found, now, input, parsed, version, settingVersion } = request;
    const { service, location, setting } = found;
    const { services, audit } = this.deps;

    if (service.updatedAt !== version || setting.updatedAt !== settingVersion) {
      return errAsync(serviceStale());
    }
    const definition = definitionOf(parsed.shared, baseOf(service));
    if (definition === null) {
      return errAsync(fieldValidationFailed('durationMinutes', CODES.durationInvalid));
    }
    const isSharedChanged = changesSharedPart(service, definition);
    if (isSharedChanged && isSharedElsewhere(service) && !input.acknowledgeShared) {
      return errAsync(serviceSharedUnacknowledged());
    }

    return loadResourcesServing(this.deps, scope, location.id).andThen((serving) =>
      linksFor(parsed.local.resources, serving).asyncAndThen((links) => {
        const next: ServiceLocationSetting = {
          locationId: location.id,
          isActive: parsed.local.isActive,
          isOnlineBookable: parsed.local.isOnlineBookable,
          resources: links,
        };
        const isLocalChanged = !deepEqual(withoutVersion(setting), next);
        if (!isSharedChanged && !isLocalChanged) {
          return loadServiceView(this.deps, { scope, found, now });
        }
        return services
          .save(scope, {
            service: isSharedChanged
              ? { stored: { ...service, ...definition }, expected: version }
              : null,
            setting: isLocalChanged
              ? { serviceId: service.id, stored: next, expected: settingVersion }
              : null,
            cancellations: [],
            now,
          })
          .andThen((saved) => {
            audit.record({
              type: 'booking.service_updated',
              tenantId: scope.tenantId,
              websiteId: scope.websiteId,
              actorId: actor.id,
              serviceId: saved.id,
              locationId: location.id,
              parts: [
                ...(isSharedChanged ? (['shared'] as const) : []),
                ...(isLocalChanged ? (['local'] as const) : []),
              ],
            });
            const savedSetting = saved.locations.find((part) => part.locationId === location.id);
            return savedSetting === undefined
              ? errAsync(serviceStale())
              : loadServiceView(this.deps, {
                  scope,
                  found: { service: saved, location, setting: savedSetting },
                  now,
                });
          });
      }),
    );
  }
}

/** A location's part without its version, to compare with what the form describes. */
function withoutVersion(setting: ServiceAtLocation['setting']): ServiceLocationSetting {
  return {
    locationId: setting.locationId,
    isActive: setting.isActive,
    isOnlineBookable: setting.isOnlineBookable,
    resources: setting.resources,
  };
}
