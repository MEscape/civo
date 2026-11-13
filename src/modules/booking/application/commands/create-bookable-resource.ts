import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  createBookingErrorBag,
} from '../../domain/errors/booking-errors';
import { parseBookingLocationId } from '../../domain/models/ids';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';
import { parsePhysicalKind, parseResourceInput } from '../services/parse-resource-input';
import { loadResourceContext } from '../services/resource-context';
import { toResourceView } from '../services/resource-views';

import type { BookingLocationId } from '../../domain/models/ids';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { NewResource } from '../../domain/ports/resource-admin.repository';
import type { ResourceAdminDependencies } from '../booking-dependencies';
import type { CreateResourceInput } from '../contracts/resource-inputs';
import type { ResourceView } from '../contracts/resource-views';
import type { ActorLimitError } from '../services/limit-actor';

export type CreateBookableResourceError =
  | BookingAccessError
  | ActorLimitError
  | ValidationAppError
  | NotFoundAppError
  | InfrastructureAppError;

/** The location and the kind, read beside the fields every change carries; all problems at once. */
function parseNew(
  input: CreateResourceInput,
): AppResult<
  { readonly locationId: BookingLocationId; readonly resource: Omit<NewResource, 'locationId'> },
  ValidationAppError
> {
  const bag = createBookingErrorBag();
  const location = parseBookingLocationId(input.locationId);
  const type = parsePhysicalKind(input.type);
  bag.expect(location.isOk(), 'locationId', CODES.locationInvalid);
  bag.expect(type !== null, 'type', CODES.resourceTypeInvalid);
  const parsed = parseResourceInput(input);
  if (parsed.isErr()) {
    for (const [path, codes] of Object.entries(parsed.error.fieldErrors)) {
      codes.forEach((code) => {
        bag.add(path, code);
      });
    }
  }
  if (bag.hasErrors || location.isErr() || type === null || parsed.isErr()) {
    return err(bag.toError());
  }
  return ok({ locationId: location.value, resource: { ...parsed.value, type, isActive: true } });
}

/**
 * A manager adds a room, a desk or a device to a location. Never a person: an employee's calendar is
 * set up with the team. The location must be one of this website's (the session decides which
 * website); a new resource holds no booking, so there is nothing for it to affect. It is not used by
 * any service until a service names it. Needs `booking.configure`.
 */
export class CreateBookableResource {
  constructor(private readonly deps: ResourceAdminDependencies) {}

  execute(input: CreateResourceInput): AppResultAsync<ResourceView, CreateBookableResourceError> {
    const { access, resources, audit, clock } = this.deps;
    const now = currentInstant(clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return parseNew(input).asyncAndThen(({ locationId, resource }) =>
          loadResourceContext(this.deps, { scope, locationId, now }).andThen((context) =>
            resources.create(scope, { ...resource, locationId }, now).map((created) => {
              audit.record({
                type: 'booking.resource_created',
                tenantId: scope.tenantId,
                websiteId: scope.websiteId,
                actorId: actor.id,
                resourceId: created.id,
                locationId,
              });
              return toResourceView(created, { ...context, websiteId: scope.websiteId });
            }),
          ),
        );
      });
  }
}
