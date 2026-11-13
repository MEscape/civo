import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { resourceNotFound } from '../../domain/errors/booking-errors';
import { currentInstant } from '../services/clock-instant';
import { previewCalendar } from '../services/employee-calendar-change';
import { parseEmployeeCalendar } from '../services/parse-employee-calendar';
import { loadOwnEmployee } from '../services/team-access';

import type { PreviewCalendarError } from './preview-team-member-change';
import type { TeamDependencies } from '../booking-dependencies';
import type { ResourceImpactView } from '../contracts/resource-views';
import type { PreviewOwnProfileChangeInput } from '../contracts/team-inputs';

/**
 * Which of their existing bookings an employee's change of their own week or absences would leave
 * without them. Reads only. "Not found" while nobody has set the calendar up. Needs
 * `booking.profile.own`.
 */
export class PreviewOwnProfileChange {
  constructor(private readonly deps: TeamDependencies) {}

  execute(
    input: PreviewOwnProfileChangeInput,
  ): AppResultAsync<ResourceImpactView, PreviewCalendarError> {
    const now = currentInstant(this.deps.clock);
    return this.deps.access
      .authorizeWebsite('booking.profile.own', input.websiteId)
      .andThen(({ actor }) => loadOwnEmployee(this.deps, actor))
      .andThen((context) =>
        context === null
          ? errAsync(resourceNotFound())
          : parseEmployeeCalendar(input.calendar).asyncAndThen((next) =>
              previewCalendar(this.deps, { ...context, next, now }),
            ),
      );
  }
}
