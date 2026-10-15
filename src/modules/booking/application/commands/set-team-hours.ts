import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES,
  fieldValidationFailed,
  resourceNotFound,
} from '../../domain/errors/booking-errors';
import { toAvailabilityPlanInput } from '../../domain/models/availability-plan';
import {
  createBookableResourceDraft,
  withManagerChange,
} from '../../domain/models/bookable-resource';
import { MAX_TEAM_HOURS_BATCH } from '../booking-limits';
import { toResourceView } from '../booking-view-mappers';
import { loadAuthorizedResource } from '../load-authorized-resource';
import { checkResourceFitsLocation } from '../services/hours-fit-checks';

import type {
  BookableResource,
  BookableResourceDraft,
} from '../../domain/models/bookable-resource';
import type { BookingDependencies } from '../booking-dependencies';
import type { SetTeamHoursInput } from '../contracts/booking-inputs';
import type { ResourceView } from '../contracts/setup-views';
import type { LoadResourceError } from '../load-authorized-resource';

type SetTeamHoursError =
  LoadResourceError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

const toText = (plan: SetTeamHoursInput['availability']): string => JSON.stringify(plan);

function isSameWeek(resource: BookableResource, next: SetTeamHoursInput['availability']): boolean {
  return (
    toText(
      resource.availability === null ? null : toAvailabilityPlanInput(resource.availability),
    ) === toText(next)
  );
}

/** An employee loaded and their new calendar already validated, ready to be saved. */
interface Prepared {
  readonly actor: Actor;
  readonly resource: BookableResource;
  readonly draft: BookableResourceDraft;
}

/**
 * Sets the working hours of employees, for those who manage the bookings: one
 * employee, or the same hours for many at once. Nothing else about an employee
 * changes (name, location, the services they offer are theirs). Every employee
 * is loaded and every new calendar validated before the first is saved, so a
 * request with one bad entry changes nobody; saving is then one employee at a
 * time. A resource that is not an employee's calendar is "not found" here.
 */
export class SetTeamHours {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: SetTeamHoursInput): AppResultAsync<readonly ResourceView[], SetTeamHoursError> {
    return this.deps.authorization.requireInTenant('booking.manage').andThen(() => {
      const ids = [...new Set(input.resourceIds)];
      if (ids.length === 0 || ids.length > MAX_TEAM_HOURS_BATCH) {
        return errAsync(fieldValidationFailed('resourceIds', BOOKING_VALIDATION_CODES.tooMany));
      }
      const prepared = ids.reduce<AppResultAsync<readonly Prepared[], SetTeamHoursError>>(
        (previous, id) =>
          previous.andThen((done) => this.prepare(id, input).map((next) => [...done, next])),
        okAsync([]),
      );
      return prepared.andThen((all) =>
        all.reduce<AppResultAsync<readonly ResourceView[], SetTeamHoursError>>(
          (previous, entry) =>
            previous.andThen((saved) => this.save(entry).map((view) => [...saved, view])),
          okAsync([]),
        ),
      );
    });
  }

  private prepare(
    id: string,
    input: SetTeamHoursInput,
  ): AppResultAsync<Prepared, SetTeamHoursError> {
    return loadAuthorizedResource(this.deps, id, 'booking.manage').andThen(
      ({ actor, resource }) => {
        if (resource.type !== 'employee') {
          return errAsync(resourceNotFound());
        }
        const draft = createBookableResourceDraft({
          websiteId: resource.websiteId,
          locationId: resource.locationId,
          name: resource.name,
          type: resource.type,
          skills: resource.skills,
          capacity: resource.capacity,
          availability: input.availability,
          isActive: resource.isActive,
          assignedActorId: resource.assignedActorId,
          // The employee is told, unless the week they have is the week they are given.
          managerChange: isSameWeek(resource, input.availability)
            ? resource.managerChange
            : withManagerChange(resource.managerChange, {
                kind: 'hours',
                at: this.deps.clock.now(),
              }),
        });
        if (draft.isErr()) {
          return errAsync(draft.error);
        }
        return checkResourceFitsLocation(
          this.deps,
          { tenantId: actor.tenantId, websiteId: resource.websiteId },
          draft.value,
        ).map((fitting) => ({ actor, resource, draft: fitting }));
      },
    );
  }

  private save({
    actor,
    resource,
    draft,
  }: Prepared): AppResultAsync<ResourceView, SetTeamHoursError> {
    return this.deps.resources.update(resource.id, actor.tenantId, draft).map((updated) => {
      this.deps.audit.record({
        type: 'booking.resource_updated',
        actorId: actor.id,
        tenantId: actor.tenantId,
        websiteId: updated.websiteId,
        resourceId: updated.id,
      });
      return toResourceView(updated);
    });
  }
}
