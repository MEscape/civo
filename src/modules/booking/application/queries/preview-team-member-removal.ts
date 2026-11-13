import type { AppResultAsync } from '@lib/result';

import { currentInstant } from '../services/clock-instant';
import { previewLeavingTeam } from '../services/leave-team';
import { loadManagedEmployee } from '../services/team-access';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { TeamDependencies } from '../booking-dependencies';
import type { ResourceImpactView } from '../contracts/resource-views';
import type { PreviewTeamMemberRemovalInput } from '../contracts/team-inputs';
import type { CalendarChangeError } from '../services/employee-calendar-change';

export type PreviewTeamMemberRemovalError = BookingAccessError | CalendarChangeError;

/**
 * The bookings that are open again when a member leaves their team, or moves to another: every booking of
 * their calendar that has not begun. Reads only. Needs `booking.configure`.
 */
export class PreviewTeamMemberRemoval {
  constructor(private readonly deps: TeamDependencies) {}

  execute(
    input: PreviewTeamMemberRemovalInput,
  ): AppResultAsync<ResourceImpactView, PreviewTeamMemberRemovalError> {
    const now = currentInstant(this.deps.clock);
    return this.deps.access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => loadManagedEmployee(this.deps, actor, input.employeeId))
      .andThen(({ scope, employee, location }) =>
        previewLeavingTeam(this.deps, { scope, employee, location, now }),
      );
  }
}
