import type { Actor } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { deepEqual } from '@lib/utils';

import {
  resourceImpactUnacknowledged,
  resourceNotFound,
  resourceStale,
} from '../../domain/errors/booking-errors';
import { parseBookableResourceId } from '../../domain/models/ids';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';
import { parseResourceInput } from '../services/parse-resource-input';
import { parseVersion } from '../services/parse-version';
import { loadResourceContext } from '../services/resource-context';
import { impactOfChange } from '../services/resource-impact';
import { toResourceView } from '../services/resource-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { StoredResource } from '../../domain/ports/resource-admin.repository';
import type { Instant } from '../../domain/time/instant';
import type { ResourceAdminDependencies } from '../booking-dependencies';
import type { UpdateResourceInput } from '../contracts/resource-inputs';
import type { ResourceImpactView, ResourceView } from '../contracts/resource-views';
import type { ActorLimitError } from '../services/limit-actor';
import type { ParsedResource } from '../services/parse-resource-input';

export type UpdateBookableResourceError =
  | BookingAccessError
  | ActorLimitError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

const NO_IMPACT: ResourceImpactView = { affected: [], isTruncated: false };

/**
 * A manager changes a physical resource: its details, when it can be used, its blocks or its places.
 * The change names the version it was made from and is refused if the resource moved on
 * (`booking.resource_stale`). A change that would leave existing bookings without the resource
 * (less time, a block, fewer places) is refused unless the manager has seen which ones and lets them
 * stand (`booking.resource_impact_unacknowledged`). Nothing is ever cancelled or moved by it and no
 * citizen is told; the booking stays, and the impact analysis finds it again. Its kind and location
 * never change. Needs `booking.configure`.
 */
export class UpdateBookableResource {
  constructor(private readonly deps: ResourceAdminDependencies) {}

  execute(input: UpdateResourceInput): AppResultAsync<ResourceView, UpdateBookableResourceError> {
    const { access, resources, clock } = this.deps;
    const now = currentInstant(clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return parseBookableResourceId(input.resourceId)
          .andThen((id) =>
            parseResourceInput(input).andThen((next) =>
              parseVersion('expectedVersion', input.expectedVersion).map((expected) => ({
                id,
                next,
                expected,
              })),
            ),
          )
          .asyncAndThen(({ id, next, expected }) =>
            resources
              .findById(scope, id)
              .andThen((current) =>
                current === null
                  ? errAsync(resourceNotFound())
                  : this.change({ actor, scope, current, next, expected, now, input }),
              ),
          );
      });
  }

  private change(request: {
    readonly actor: Actor;
    readonly scope: BookingScope;
    readonly current: StoredResource;
    readonly next: ParsedResource;
    readonly expected: Instant;
    readonly now: Instant;
    readonly input: UpdateResourceInput;
  }): AppResultAsync<ResourceView, UpdateBookableResourceError> {
    const { actor, scope, current, next, expected, now, input } = request;
    const { resources, audit } = this.deps;

    if (current.updatedAt !== expected) {
      return errAsync(resourceStale());
    }
    const isAvailabilityChanged = !deepEqual(next.availability, current.availability);
    const losesPlaces = next.capacity < (current.capacity ?? 1);
    const impact =
      isAvailabilityChanged || losesPlaces
        ? impactOfChange(this.deps, { scope, resource: current, next, now })
        : okAsync(NO_IMPACT);

    return impact
      .andThen((found) =>
        (found.affected.length > 0 || found.isTruncated) && !input.acknowledgeImpact
          ? errAsync(resourceImpactUnacknowledged())
          : resources
              .save(scope, { stored: { ...current, ...next }, expected, now })
              .map((saved) => {
                audit.record({
                  type: 'booking.resource_updated',
                  tenantId: scope.tenantId,
                  websiteId: scope.websiteId,
                  actorId: actor.id,
                  resourceId: saved.id,
                  locationId: saved.locationId,
                  sections: [
                    ...(isAvailabilityChanged ? (['availability'] as const) : []),
                    ...(isDetailsChanged(current, next) ? (['details'] as const) : []),
                  ],
                  leftOpen: found.affected.length,
                });
                return saved;
              }),
      )
      .andThen((saved) =>
        loadResourceContext(this.deps, { scope, locationId: saved.locationId, now }).map(
          (context) => toResourceView(saved, { ...context, websiteId: scope.websiteId }),
        ),
      );
  }
}

function isDetailsChanged(current: StoredResource, next: ParsedResource): boolean {
  return (
    current.name !== next.name ||
    current.capacity !== next.capacity ||
    current.setupMinutes !== next.setupMinutes ||
    current.teardownMinutes !== next.teardownMinutes ||
    current.internalNote !== next.internalNote
  );
}
