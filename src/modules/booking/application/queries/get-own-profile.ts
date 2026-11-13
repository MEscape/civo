import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { formatLocalDate } from '../../domain/time/local-date';
import { localDateOf } from '../../domain/time/time-zone';
import { currentInstant } from '../services/clock-instant';
import { loadOwnEmployee } from '../services/team-access';
import { toTeamMemberView } from '../services/team-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { TeamDependencies } from '../booking-dependencies';
import type { WebsiteTargetInput } from '../contracts/booking-inputs';
import type { OwnProfileView } from '../contracts/team-views';

/**
 * The signed-in employee's own calendar: their location, their qualifications (read only), their
 * week and absences, where a manager sends them, and what day it is for them. `null` while nobody has set
 * it up. Found by the person, never by an id. Needs `booking.profile.own`.
 */
export class GetOwnProfile {
  constructor(private readonly deps: TeamDependencies) {}

  execute(
    input: WebsiteTargetInput,
  ): AppResultAsync<
    OwnProfileView | null,
    BookingAccessError | NotFoundAppError | InfrastructureAppError
  > {
    return this.deps.access
      .authorizeWebsite('booking.profile.own', input.websiteId)
      .andThen(({ actor }) => loadOwnEmployee(this.deps, actor))
      .map((context) =>
        context === null
          ? null
          : {
              ...toTeamMemberView(context.employee, {
                websiteId: context.scope.websiteId,
                location: context.location,
                name: undefined,
                knownQualifications: [],
                places: context.places,
              }),
              today: formatLocalDate(
                localDateOf(currentInstant(this.deps.clock), context.location.zone),
              ),
            },
      );
  }
}
