import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { ResultAsync, errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { locationNotFound } from '../../domain/errors/booking-errors';
import { parseBookingLocationId } from '../../domain/models/ids';
import { MAX_RESOURCES_PER_WEBSITE } from '../booking-limits';
import { scopeOfActor } from '../services/booking-scope';
import { employeeNames, placesOf } from '../services/team-access';
import { toTeamMemberSummary, visitorsOf } from '../services/team-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { TeamDependencies } from '../booking-dependencies';
import type { GetTeamInput } from '../contracts/team-inputs';
import type { TeamView } from '../contracts/team-views';

export type GetTeamError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The employees at a location, by name, with their week, absences and qualifications, and the
 * members with the role `employee` who have no calendar anywhere yet (they can be set up here).
 * Names come from the member directory, never an e-mail address. Needs `booking.configure`.
 */
export class GetTeam {
  constructor(private readonly deps: TeamDependencies) {}

  execute(input: GetTeamInput): AppResultAsync<TeamView, GetTeamError> {
    const { access, locations, team } = this.deps;

    return access.authorizeWebsite('booking.configure', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return parseBookingLocationId(input.locationId).asyncAndThen((locationId) =>
        locations.findById(scope, locationId).andThen((location) => {
          if (location === null) {
            return errAsync(locationNotFound());
          }
          return ResultAsync.combine([
            team.listAt(scope, location.id, MAX_RESOURCES_PER_WEBSITE),
            team.listVisiting(scope, location.id, MAX_RESOURCES_PER_WEBSITE),
            team.listActorIds(scope, MAX_RESOURCES_PER_WEBSITE),
            employeeNames(this.deps, scope.websiteId),
            placesOf(this.deps, scope),
          ] as const).map(([listed, visiting, withCalendar, { names, isTruncated }, places]) => {
            const { members } = listed;
            const hasCalendar = new Set(withCalendar.actorIds.map(String));
            return {
              location: { id: location.id, name: location.name },
              members: members.map((employee) =>
                toTeamMemberSummary(employee, {
                  location,
                  name: names.get(employee.actorId),
                  places,
                }),
              ),
              moveTargets: places.filter(({ id }) => id !== location.id),
              visitors: visitorsOf(visiting.members, { here: location.id, names, places }),
              candidates: [...names]
                .filter(([id]) => !hasCalendar.has(id))
                .map(([actorId, name]) => ({ actorId, name })),
              isTruncated:
                isTruncated ||
                listed.isTruncated ||
                visiting.isTruncated ||
                withCalendar.isTruncated,
            };
          });
        }),
      );
    });
  }
}
