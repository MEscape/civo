import type { AppResultAsync } from '@lib/result';

import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { changeCalendar } from '../services/employee-calendar-change';
import { withinActorLimit } from '../services/limit-actor';
import { parseCoverage } from '../services/parse-coverage';
import { parseEmployeeCalendar, parseQualifications } from '../services/parse-employee-calendar';
import { parseVersion } from '../services/parse-version';
import {
  coverageRulesOf,
  knownQualificationsAt,
  loadManagedEmployee,
} from '../services/team-access';
import { toTeamMemberView } from '../services/team-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { TeamDependencies } from '../booking-dependencies';
import type { UpdateTeamMemberInput } from '../contracts/team-inputs';
import type { TeamMemberView } from '../contracts/team-views';
import type { CalendarChangeError } from '../services/employee-calendar-change';
import type { ActorLimitError } from '../services/limit-actor';

export type UpdateTeamMemberError = BookingAccessError | ActorLimitError | CalendarChangeError;

/**
 * A manager changes an employee's week, absences, qualifications or cover at other locations (only
 * managers grant qualifications, BD-06, and send people elsewhere). The week must lie inside the location's hours; a change that leaves bookings without the
 * employee is saved only once the manager has seen them; nothing is cancelled or moved. Whatever
 * changed is added to the notice the employee sees until they acknowledge it (EX-19). Needs
 * `booking.configure`.
 */
export class UpdateTeamMember {
  constructor(private readonly deps: TeamDependencies) {}

  execute(input: UpdateTeamMemberInput): AppResultAsync<TeamMemberView, UpdateTeamMemberError> {
    const { access, audit } = this.deps;
    const now = currentInstant(this.deps.clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) =>
        loadManagedEmployee(this.deps, actor, input.employeeId).andThen((context) =>
          parseEmployeeCalendar(input)
            .andThen((calendar) =>
              parseQualifications(input.qualifications).andThen((qualifications) =>
                parseCoverage(input.coverage, coverageRulesOf(context)).andThen((coverage) =>
                  parseVersion('expectedVersion', input.expectedVersion).map((expected) => ({
                    next: { ...calendar, qualifications, coverage },
                    expected,
                  })),
                ),
              ),
            )
            .asyncAndThen(({ next, expected }) =>
              changeCalendar(this.deps, {
                scope: context.scope,
                employee: context.employee,
                next,
                expected,
                now,
                acknowledgeImpact: input.acknowledgeImpact,
                byManager: true,
                actorId: actor.id,
              }),
            )
            .andThen(({ saved, parts, leftOpen }) => {
              audit.record({
                type: 'booking.team_member_updated',
                actorId: actor.id,
                tenantId: context.scope.tenantId,
                websiteId: context.scope.websiteId,
                resourceId: saved.id,
                locationId: saved.locationId,
                memberId: saved.actorId,
                parts,
                leftOpen,
              });
              return knownQualificationsAt(this.deps, context).map((knownQualifications) =>
                toTeamMemberView(saved, {
                  websiteId: context.scope.websiteId,
                  location: context.location,
                  name: undefined,
                  knownQualifications,
                  places: context.places,
                }),
              );
            }),
        ),
      );
  }
}
