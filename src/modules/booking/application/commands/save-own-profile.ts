import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { resourceNotFound } from '../../domain/errors/booking-errors';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { currentInstant } from '../services/clock-instant';
import { changeCalendar } from '../services/employee-calendar-change';
import { withinActorLimit } from '../services/limit-actor';
import { parseEmployeeCalendar } from '../services/parse-employee-calendar';
import { parseVersion } from '../services/parse-version';
import { loadOwnEmployee } from '../services/team-access';
import { toTeamMemberView } from '../services/team-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { TeamDependencies } from '../booking-dependencies';
import type { SaveOwnProfileInput } from '../contracts/team-inputs';
import type { TeamMemberView } from '../contracts/team-views';
import type { CalendarChangeError } from '../services/employee-calendar-change';
import type { ActorLimitError } from '../services/limit-actor';

export type SaveOwnProfileError = BookingAccessError | ActorLimitError | CalendarChangeError;

/**
 * An employee changes their own week and absences: never their location or their qualifications,
 * which managers look after. The calendar is found by the person signed in, never by an id, so
 * nobody changes a colleague's; one that nobody has set up yet is "not found". The same rules as a
 * manager's change apply (inside the location's hours, bookings left without them only once seen).
 * Saving also clears the notice of a manager's change: they have looked at their calendar. Needs
 * `booking.profile.own`.
 */
export class SaveOwnProfile {
  constructor(private readonly deps: TeamDependencies) {}

  execute(input: SaveOwnProfileInput): AppResultAsync<TeamMemberView, SaveOwnProfileError> {
    const { access, audit } = this.deps;
    const now = currentInstant(this.deps.clock);

    return access
      .authorizeWebsite('booking.profile.own', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) =>
        loadOwnEmployee(this.deps, actor).andThen((context) => {
          if (context === null) {
            return errAsync(resourceNotFound());
          }
          return parseEmployeeCalendar(input)
            .andThen((next) =>
              parseVersion('expectedVersion', input.expectedVersion).map((expected) => ({
                next,
                expected,
              })),
            )
            .asyncAndThen(({ next, expected }) =>
              changeCalendar(this.deps, {
                scope: context.scope,
                employee: context.employee,
                next,
                expected,
                now,
                acknowledgeImpact: input.acknowledgeImpact,
                byManager: false,
                actorId: actor.id,
              }),
            )
            .map(({ saved, parts, leftOpen }) => {
              audit.record({
                type: 'booking.team_member_updated',
                actorId: actor.id,
                tenantId: context.scope.tenantId,
                websiteId: context.scope.websiteId,
                resourceId: saved.id,
                locationId: saved.locationId,
                memberId: actor.id,
                parts,
                leftOpen,
              });
              return toTeamMemberView(saved, {
                websiteId: context.scope.websiteId,
                location: context.location,
                name: undefined,
                knownQualifications: [],
                places: context.places,
              });
            });
        }),
      );
  }
}
