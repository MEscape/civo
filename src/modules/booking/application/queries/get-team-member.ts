import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { employeeNames, knownQualificationsAt, loadManagedEmployee } from '../services/team-access';
import { toTeamMemberView } from '../services/team-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { TeamDependencies } from '../booking-dependencies';
import type { GetTeamMemberInput } from '../contracts/team-inputs';
import type { TeamMemberView } from '../contracts/team-views';

export type GetTeamMemberError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * One employee's calendar in the shape the manager's form edits, with the qualifications held at
 * the location to choose from and the version a change must name. A physical resource or another
 * website's calendar is "not found". Needs `booking.configure`.
 */
export class GetTeamMember {
  constructor(private readonly deps: TeamDependencies) {}

  execute(input: GetTeamMemberInput): AppResultAsync<TeamMemberView, GetTeamMemberError> {
    return this.deps.access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => loadManagedEmployee(this.deps, actor, input.employeeId))
      .andThen((context) =>
        ResultAsync.combine([
          employeeNames(this.deps, context.scope.websiteId),
          knownQualificationsAt(this.deps, context),
        ] as const).map(([{ names }, knownQualifications]) =>
          toTeamMemberView(context.employee, {
            websiteId: context.scope.websiteId,
            location: context.location,
            name: names.get(context.employee.actorId),
            knownQualifications,
            places: context.places,
          }),
        ),
      );
  }
}
