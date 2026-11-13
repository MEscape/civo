import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { serviceStale } from '../../domain/errors/booking-errors';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';
import { loadServiceAtLocation } from '../services/load-service-at-location';
import { loadServiceView } from '../services/load-service-view';
import { parseVersion } from '../services/parse-version';
import { parseScope } from '../services/service-impact';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { ReactivateServiceInput } from '../contracts/service-inputs';
import type { ServiceView } from '../contracts/service-views';
import type { ActorLimitError } from '../services/limit-actor';

export type ReactivateServiceError =
  | BookingAccessError
  | ActorLimitError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

/**
 * A manager switches a service on again, here or as a whole. Nothing has to be decided for it: it
 * takes effect at once, and what was switched off in the other direction stays as it is (a service
 * off as a whole is on again only when that is reversed, and a location that switched it off for
 * itself keeps it off). Needs `booking.configure`.
 */
export class ReactivateService {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(input: ReactivateServiceInput): AppResultAsync<ServiceView, ReactivateServiceError> {
    const { access, services, audit, clock } = this.deps;
    const now = currentInstant(clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return parseScope(input.scope)
          .andThen((opening) =>
            parseVersion('expectedVersion', input.expectedVersion).andThen((version) =>
              parseVersion('expectedSettingVersion', input.expectedSettingVersion).map(
                (settingVersion) => ({ opening, version, settingVersion }),
              ),
            ),
          )
          .asyncAndThen(({ opening, version, settingVersion }) =>
            loadServiceAtLocation(this.deps, scope, input).andThen(
              ({ service, location, setting }) => {
                const isAll = opening === 'all';
                if (isAll ? service.updatedAt !== version : setting.updatedAt !== settingVersion) {
                  return errAsync(serviceStale());
                }
                return services
                  .save(scope, {
                    service: isAll
                      ? { stored: { ...service, isActive: true }, expected: version }
                      : null,
                    setting: isAll
                      ? null
                      : {
                          serviceId: service.id,
                          stored: {
                            locationId: location.id,
                            isActive: true,
                            isOnlineBookable: setting.isOnlineBookable,
                            resources: setting.resources,
                          },
                          expected: settingVersion,
                        },
                    cancellations: [],
                    now,
                  })
                  .andThen((saved) => {
                    audit.record({
                      type: 'booking.service_reactivated',
                      tenantId: scope.tenantId,
                      websiteId: scope.websiteId,
                      actorId: actor.id,
                      serviceId: saved.id,
                      locationId: location.id,
                      scope: opening,
                    });
                    const savedSetting = saved.locations.find(
                      (part) => part.locationId === location.id,
                    );
                    return savedSetting === undefined
                      ? errAsync(serviceStale())
                      : loadServiceView(this.deps, {
                          scope,
                          found: { service: saved, location, setting: savedSetting },
                          now,
                        });
                  });
              },
            ),
          );
      });
  }
}
