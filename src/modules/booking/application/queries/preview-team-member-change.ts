import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { ok } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { currentInstant } from '../services/clock-instant';
import { previewCalendar } from '../services/employee-calendar-change';
import { parseCoverage } from '../services/parse-coverage';
import { parseEmployeeCalendar } from '../services/parse-employee-calendar';
import { coverageRulesOf, loadManagedEmployee } from '../services/team-access';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { TeamDependencies } from '../booking-dependencies';
import type { ResourceImpactView } from '../contracts/resource-views';
import type { PreviewTeamMemberChangeInput } from '../contracts/team-inputs';

export type PreviewCalendarError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * Which existing bookings a manager's change of an employee's week or absences would leave without
 * the employee. Reads only; a week outside the location's hours is refused at its days. Needs
 * `booking.configure`.
 */
export class PreviewTeamMemberChange {
  constructor(private readonly deps: TeamDependencies) {}

  execute(
    input: PreviewTeamMemberChangeInput,
  ): AppResultAsync<ResourceImpactView, PreviewCalendarError> {
    const now = currentInstant(this.deps.clock);
    return this.deps.access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => loadManagedEmployee(this.deps, actor, input.employeeId))
      .andThen((context) =>
        parseEmployeeCalendar(input.calendar)
          .andThen((calendar) =>
            input.coverage === undefined
              ? ok(calendar)
              : parseCoverage(input.coverage, coverageRulesOf(context)).map((coverage) => ({
                  ...calendar,
                  coverage,
                })),
          )
          .asyncAndThen((next) => previewCalendar(this.deps, { ...context, next, now })),
      );
  }
}
