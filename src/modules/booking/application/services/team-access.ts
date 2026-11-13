import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { resourceNotFound } from '../../domain/errors/booking-errors';
import { parseBookableResourceId } from '../../domain/models/ids';
import { MAX_LOCATIONS_NAMED, MAX_RESOURCES_PER_WEBSITE } from '../booking-limits';

import { scopeOfActor } from './booking-scope';
import { locationOfEmployee } from './employee-calendar-change';
import { qualificationsOfEmployee } from './team-views';

import type { WebsiteId } from '../../domain/models/ids';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { StoredEmployee } from '../../domain/ports/team.repository';
import type { TeamDependencies } from '../booking-dependencies';
import type { LocationNameView } from '../contracts/service-views';

/** A calendar with what every view of it needs: the scope it was found in, its location and the places it can be sent to. */
export interface EmployeeContext {
  readonly scope: BookingScope;
  readonly employee: StoredEmployee;
  readonly location: StoredLocation;
  /** Every location of the website, by name: where a spell of cover can send the person. */
  readonly places: readonly LocationNameView[];
}

/** The locations of the website by name, active ones first not implied: a manager may send someone anywhere that exists. */
export function placesOf(
  deps: Pick<TeamDependencies, 'locations'>,
  scope: BookingScope,
): AppResultAsync<LocationNameView[], InfrastructureAppError> {
  return deps.locations
    .list(scope, { limit: MAX_LOCATIONS_NAMED, offset: 0 })
    .map((locations) => locations.map(({ id, name }) => ({ id, name })));
}

/** What the rules for cover read of a calendar: its own location, and the locations that exist. */
export function coverageRulesOf(context: Pick<EmployeeContext, 'employee' | 'places'>) {
  return {
    home: context.employee.locationId,
    locationIds: new Set(context.places.map(({ id }) => id)),
  };
}

/** The calendar with its places: what the views and the cover rules read. */
function withPlaces(
  deps: Pick<TeamDependencies, 'team' | 'locations'>,
  scope: BookingScope,
  employee: StoredEmployee,
): AppResultAsync<EmployeeContext, NotFoundAppError | InfrastructureAppError> {
  return locationOfEmployee(deps, scope, employee).andThen((location) =>
    placesOf(deps, scope).map((places) => ({ scope, employee, location, places })),
  );
}

/** A calendar a manager names by id; another website's, or a physical resource, is "not found". */
export function loadManagedEmployee(
  deps: Pick<TeamDependencies, 'team' | 'locations'>,
  actor: Actor,
  rawId: string,
): AppResultAsync<EmployeeContext, ValidationAppError | NotFoundAppError | InfrastructureAppError> {
  const scope = scopeOfActor(actor);
  return parseBookableResourceId(rawId).asyncAndThen((id) =>
    deps.team
      .findById(scope, id)
      .andThen((employee) => (employee === null ? errAsync(resourceNotFound()) : okAsync(employee)))
      .andThen((employee) => withPlaces(deps, scope, employee)),
  );
}

/**
 * The signed-in employee's own calendar, found by the person and never by an id from the request;
 * `null` while no manager has set it up.
 */
export function loadOwnEmployee(
  deps: Pick<TeamDependencies, 'team' | 'locations'>,
  actor: Actor,
): AppResultAsync<EmployeeContext | null, NotFoundAppError | InfrastructureAppError> {
  const scope = scopeOfActor(actor);
  return deps.team
    .findOfActor(scope, actor.id)
    .andThen((employee) => (employee === null ? okAsync(null) : withPlaces(deps, scope, employee)));
}

/** The members with the role `employee`, by id, as the member directory names them; `isTruncated` when it names only some. */
export function employeeNames(
  deps: Pick<TeamDependencies, 'directory'>,
  websiteId: WebsiteId,
): AppResultAsync<
  { readonly names: ReadonlyMap<string, string>; readonly isTruncated: boolean },
  BookingAccessError
> {
  return deps.directory.listEmployees(websiteId).map(({ members, isTruncated }) => ({
    names: new Map(members.map(({ id, name }) => [String(id), name])),
    isTruncated,
  }));
}

/** The qualifications held by the calendars at a location: what a manager chooses from. */
export function knownQualificationsAt(
  deps: Pick<TeamDependencies, 'team'>,
  context: EmployeeContext,
): AppResultAsync<string[], InfrastructureAppError> {
  return deps.team
    .listAt(context.scope, context.location.id, MAX_RESOURCES_PER_WEBSITE)
    .map(({ members }) =>
      unique(members.flatMap(qualificationsOfEmployee)).sort((a, b) => a.localeCompare(b)),
    );
}
