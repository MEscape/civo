import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { ResultAsync, errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
  locationNotFound,
} from '../../domain/errors/booking-errors';
import { parseBookingLocationId } from '../../domain/models/ids';
import { RESOURCE_LIMITS } from '../contracts/booking-constraints';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';
import { toTeamMemberView } from '../services/team-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { TeamDependencies } from '../booking-dependencies';
import type { SetUpTeamMemberInput } from '../contracts/team-inputs';
import type { TeamMemberView } from '../contracts/team-views';
import type { ActorLimitError } from '../services/limit-actor';

export type SetUpTeamMemberError =
  | BookingAccessError
  | ActorLimitError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

/**
 * A manager gives a member their calendar at a location: one per member (EX-19), so a member who has
 * one anywhere is refused (`booking.employee_already_set_up`). Only a member of the manager's own
 * tenant who holds the role `employee` can be set up; anyone else is an invalid choice. The calendar
 * starts with the location's hours, no absences and no qualifications, and the employee is told that
 * it was set up for them. Needs `booking.configure`.
 */
export class SetUpTeamMember {
  constructor(private readonly deps: TeamDependencies) {}

  execute(input: SetUpTeamMemberInput): AppResultAsync<TeamMemberView, SetUpTeamMemberError> {
    const { access, locations, team, directory, audit } = this.deps;
    const now = currentInstant(this.deps.clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return parseBookingLocationId(input.locationId).asyncAndThen((locationId) =>
          ResultAsync.combine([
            locations.findById(scope, locationId),
            directory.listEmployees(scope.websiteId),
          ] as const).andThen(([location, roster]) => {
            const member = roster.members.find(({ id }) => id === input.actorId);
            if (location === null) {
              return errAsync(locationNotFound());
            }
            if (member === undefined) {
              return errAsync(fieldValidationFailed('actorId', CODES.idInvalid));
            }
            return team
              .create(
                scope,
                {
                  actorId: member.id,
                  name: member.name.slice(0, RESOURCE_LIMITS.nameMax).trim() || member.id,
                  locationId: location.id,
                  skills: [],
                  isActive: true,
                  availability: null,
                  coverage: [],
                  notice: ['setup'],
                },
                now,
              )
              .map((employee) => {
                audit.record({
                  type: 'booking.team_member_set_up',
                  actorId: actor.id,
                  tenantId: scope.tenantId,
                  websiteId: scope.websiteId,
                  resourceId: employee.id,
                  locationId: location.id,
                  memberId: member.id,
                });
                return toTeamMemberView(employee, {
                  websiteId: scope.websiteId,
                  location,
                  name: member.name,
                  knownQualifications: [],
                  places: [],
                });
              });
          }),
        );
      });
  }
}
