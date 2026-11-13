import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
  locationNotFound,
} from '../../domain/errors/booking-errors';
import { parseBookingLocationId } from '../../domain/models/ids';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { leaveTeam } from '../services/leave-team';
import { withinActorLimit } from '../services/limit-actor';
import { parseVersion } from '../services/parse-version';
import { loadManagedEmployee } from '../services/team-access';
import { toTeamMemberView } from '../services/team-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { TeamDependencies } from '../booking-dependencies';
import type { MoveTeamMemberInput } from '../contracts/team-inputs';
import type { TeamMemberView } from '../contracts/team-views';
import type { CalendarChangeError } from '../services/employee-calendar-change';
import type { ActorLimitError } from '../services/limit-actor';

export type MoveTeamMemberError =
  | BookingAccessError
  | ActorLimitError
  | CalendarChangeError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

/**
 * A manager moves a member to the team of another location. A calendar never changes its location (the
 * bookings it held depend on it), so the old one is taken out of the team like in `RemoveTeamMember`
 * (its bookings that have not begun are open again) and the member gets a new one at the other location:
 * the same qualifications, the location's hours, no absences or cover. The member is told it was set up
 * for them. Needs `booking.configure`.
 */
export class MoveTeamMember {
  constructor(private readonly deps: TeamDependencies) {}

  execute(input: MoveTeamMemberInput): AppResultAsync<TeamMemberView, MoveTeamMemberError> {
    const { access, audit, locations, team } = this.deps;
    const now = currentInstant(this.deps.clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) =>
        loadManagedEmployee(this.deps, actor, input.employeeId).andThen((context) => {
          const { scope, employee, location } = context;
          return parseBookingLocationId(input.locationId).asyncAndThen((targetId) => {
            if (targetId === employee.locationId) {
              return errAsync(fieldValidationFailed('locationId', CODES.idInvalid));
            }
            return locations.findById(scope, targetId).andThen((target) => {
              if (target === null) {
                return errAsync(locationNotFound());
              }
              return parseVersion('expectedVersion', input.expectedVersion)
                .asyncAndThen((expected) =>
                  leaveTeam(this.deps, {
                    scope,
                    employee,
                    location,
                    expected,
                    now,
                    acknowledgeImpact: input.acknowledgeImpact,
                    actorId: actor.id,
                  }),
                )
                .andThen(({ saved, released }) =>
                  team
                    .create(
                      scope,
                      {
                        actorId: employee.actorId,
                        name: employee.name,
                        locationId: target.id,
                        skills: employee.skills,
                        isActive: true,
                        availability: null,
                        coverage: [],
                        notice: ['setup'],
                      },
                      now,
                    )
                    .map((created) => {
                      audit.record({
                        type: 'booking.team_member_moved',
                        actorId: actor.id,
                        tenantId: scope.tenantId,
                        websiteId: scope.websiteId,
                        resourceId: saved.id,
                        locationId: target.id,
                        memberId: employee.actorId,
                        leftOpen: released,
                      });
                      return toTeamMemberView(created, {
                        websiteId: scope.websiteId,
                        location: target,
                        name: undefined,
                        knownQualifications: [],
                        places: context.places,
                      });
                    }),
                );
            });
          });
        }),
      );
  }
}
