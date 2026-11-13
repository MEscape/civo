import type { AppResultAsync } from '@lib/result';

import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { leaveTeam } from '../services/leave-team';
import { withinActorLimit } from '../services/limit-actor';
import { parseVersion } from '../services/parse-version';
import { loadManagedEmployee } from '../services/team-access';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { TeamDependencies } from '../booking-dependencies';
import type { RemoveTeamMemberInput } from '../contracts/team-inputs';
import type { TeamLeftView } from '../contracts/team-views';
import type { CalendarChangeError } from '../services/employee-calendar-change';
import type { ActorLimitError } from '../services/limit-actor';

export type RemoveTeamMemberError = BookingAccessError | ActorLimitError | CalendarChangeError;

/**
 * A manager takes a member out of their team. The calendar is switched off, never deleted, and every
 * booking of it that has not begun is open again, the same way as when an absence or new hours leave a
 * booking without the employee; nothing is cancelled. Saved only once the manager has seen those
 * bookings. The member can be set up again, at any location. Needs `booking.configure`.
 */
export class RemoveTeamMember {
  constructor(private readonly deps: TeamDependencies) {}

  execute(input: RemoveTeamMemberInput): AppResultAsync<TeamLeftView, RemoveTeamMemberError> {
    const { access, audit } = this.deps;
    const now = currentInstant(this.deps.clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) =>
        loadManagedEmployee(this.deps, actor, input.employeeId).andThen(
          ({ scope, employee, location }) =>
            parseVersion('expectedVersion', input.expectedVersion)
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
              .map(({ saved, released }) => {
                audit.record({
                  type: 'booking.team_member_removed',
                  actorId: actor.id,
                  tenantId: scope.tenantId,
                  websiteId: scope.websiteId,
                  resourceId: saved.id,
                  locationId: saved.locationId,
                  memberId: saved.actorId,
                  leftOpen: released,
                });
                return {
                  websiteId: scope.websiteId,
                  employeeId: saved.id,
                  releasedBookings: released,
                };
              }),
        ),
      );
  }
}
