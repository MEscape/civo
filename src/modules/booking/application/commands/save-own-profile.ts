import type { AuthorizationError, TenantId } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES,
  fieldValidationFailed,
  hasUpcomingBookings,
} from '../../domain/errors/booking-errors';
import { createBookableResourceDraft } from '../../domain/models/bookable-resource';
import { parseWebsiteId } from '../../domain/models/ids';
import { withOfferedServices } from '../../domain/models/service-skill';
import { MAX_SERVICES_PER_WEBSITE } from '../booking-limits';
import { toResourceView } from '../booking-view-mappers';
import { checkResourceFitsLocation } from '../services/hours-fit-checks';
import { checkLocationReference } from '../services/reference-checks';

import type { BookableResource } from '../../domain/models/bookable-resource';
import type { BookingDependencies } from '../booking-dependencies';
import type { SaveOwnProfileInput } from '../contracts/booking-inputs';
import type { ResourceView } from '../contracts/setup-views';

type SaveOwnProfileError =
  | AuthorizationError
  | ConflictAppError
  | ValidationAppError
  | NotFoundAppError
  | InfrastructureAppError;

/**
 * An employee sets up their own place in the booking system: the calendar
 * that is theirs (made the first time, changed after), its working hours, the
 * one location they work at, and which of the services offered there they
 * offer. It needs `booking.profile.own` and touches nothing else: the calendar
 * is found by the person, never by an id from the request, so nobody can
 * change a colleague's. Everything an administrator sets up (the services,
 * the locations) is only chosen from, never changed.
 *
 * Moving to another location is refused while upcoming bookings still hold
 * the calendar: those visitors were promised a person at the place they
 * booked, so the bookings are moved or cancelled first.
 */
export class SaveOwnProfile {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: SaveOwnProfileInput): AppResultAsync<ResourceView, SaveOwnProfileError> {
    const { authorization, resources, audit } = this.deps;

    return authorization.requireInTenant('booking.profile.own').andThen((actor) => {
      const parsed = parseWebsiteId(input.websiteId);
      if (parsed.isErr()) {
        return errAsync(parsed.error);
      }
      const scope = { websiteId: parsed.value, tenantId: actor.tenantId };

      return this.requireOfferable(scope, input)
        .andThen(() => resources.listAssignedTo(scope, actor.id, 1))
        .andThen(([existing]) =>
          this.requireNoUpcomingMove(existing, input.locationId, actor.tenantId).andThen(() =>
            createBookableResourceDraft({
              websiteId: scope.websiteId,
              locationId: input.locationId,
              name: input.name,
              type: 'employee',
              skills: withOfferedServices(existing?.skills ?? [], input.offeredServiceIds),
              capacity: null,
              availability: input.availability,
              isActive: true,
              assignedActorId: actor.id,
            })
              .asyncAndThen((draft) => checkLocationReference(this.deps, scope, draft))
              .andThen((draft) => checkResourceFitsLocation(this.deps, scope, draft))
              .andThen((draft) =>
                existing === undefined
                  ? resources.create({ tenantId: actor.tenantId, draft })
                  : resources.update(existing.id, actor.tenantId, draft),
              )
              .map((saved) => {
                const event = {
                  actorId: actor.id,
                  tenantId: actor.tenantId,
                  websiteId: saved.websiteId,
                  resourceId: saved.id,
                };
                if (existing === undefined) {
                  audit.record({ type: 'booking.resource_created', ...event });
                } else {
                  audit.record({ type: 'booking.resource_updated', ...event });
                }
                return toResourceView(saved);
              }),
          ),
        );
    });
  }

  /** Only services that exist and are offered where the employee works can be offered by them. */
  private requireOfferable(
    scope: { readonly websiteId: BookableResource['websiteId']; readonly tenantId: TenantId },
    input: SaveOwnProfileInput,
  ): AppResultAsync<undefined, ValidationAppError | InfrastructureAppError> {
    return this.deps.services
      .listByWebsite(scope.websiteId, scope.tenantId, MAX_SERVICES_PER_WEBSITE)
      .andThen((stored) => {
        const offerable = new Set(
          stored
            .filter((service) => service.locationIds.some((id) => id === input.locationId))
            .map((service) => service.id as string),
        );
        return input.offeredServiceIds.every((id) => offerable.has(id))
          ? okAsync(undefined)
          : errAsync(
              fieldValidationFailed('offeredServiceIds', BOOKING_VALIDATION_CODES.idInvalid),
            );
      });
  }

  private requireNoUpcomingMove(
    existing: BookableResource | undefined,
    locationId: string,
    tenantId: TenantId,
  ): AppResultAsync<undefined, ConflictAppError | InfrastructureAppError> {
    if (existing === undefined || existing.locationId === locationId) {
      return okAsync(undefined);
    }
    return this.deps.bookings
      .hasUpcoming({ kind: 'resource', id: existing.id }, tenantId, this.deps.clock.now())
      .andThen((hasUpcoming) =>
        hasUpcoming ? errAsync(hasUpcomingBookings()) : okAsync(undefined),
      );
  }
}
