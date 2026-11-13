import { blocksOf, ownWeekOf } from '../../domain/models/resource-availability';
import { WEEKDAYS } from '../../domain/scheduling/weekly-hours';
import { instantToDate } from '../../domain/time/instant';
import { formatLocalDate } from '../../domain/time/local-date';

import { toDayInput } from './location-views';
import { isQualification } from './service-resources';

import type { ResourceBlock } from '../../domain/models/resource-availability';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { StoredEmployee } from '../../domain/ports/team.repository';
import type { WeeklyHours } from '../../domain/scheduling/weekly-hours';
import type { LocationNameView } from '../contracts/service-views';
import type {
  CoverageView,
  TeamMemberSummaryView,
  TeamMemberView,
  TeamVisitorView,
} from '../contracts/team-views';

/** The week an employee works: their own, or the location's when they keep its hours. */
export function weekOf(employee: StoredEmployee, location: StoredLocation): WeeklyHours {
  return ownWeekOf(employee.availability) ?? location.openingHours.weekly;
}

export function absencesOf(employee: StoredEmployee): ResourceBlock[] {
  return blocksOf(employee.availability);
}

/** The qualifications an employee holds; a first-version service offer (`svc-<id>`) is not one. */
export function qualificationsOfEmployee(employee: StoredEmployee): string[] {
  return employee.skills.filter(isQualification);
}

/** The spells of cover with the names of their places (a place no longer known is named by its id). */
function coverageViews(
  employee: StoredEmployee,
  places: readonly LocationNameView[],
): CoverageView[] {
  const names = new Map(places.map(({ id, name }) => [id, name]));
  return employee.coverage.map((spell) => ({
    locationId: spell.locationId,
    locationName: names.get(spell.locationId) ?? spell.locationId,
    from: formatLocalDate(spell.from),
    to: formatLocalDate(spell.to),
  }));
}

/** The spells that send people of other locations here, one entry per spell, soonest first. */
export function visitorsOf(
  visiting: readonly StoredEmployee[],
  context: {
    readonly here: StoredLocation['id'];
    readonly names: ReadonlyMap<string, string>;
    readonly places: readonly LocationNameView[];
  },
): TeamVisitorView[] {
  const homes = new Map(context.places.map((place) => [place.id, place]));
  return visiting
    .flatMap((employee) =>
      employee.coverage
        .filter((spell) => spell.locationId === context.here)
        .map((spell) => ({
          id: employee.id,
          name: context.names.get(employee.actorId) ?? employee.name,
          home: homes.get(employee.locationId) ?? { id: employee.locationId, name: '' },
          from: formatLocalDate(spell.from),
          to: formatLocalDate(spell.to),
        })),
    )
    .sort((a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name));
}

const toWeekInput = (week: WeeklyHours) => WEEKDAYS.map((weekday) => toDayInput(week[weekday]));

/** An employee in the team list, named by the member directory (or by their calendar). */
export function toTeamMemberSummary(
  employee: StoredEmployee,
  context: {
    readonly location: StoredLocation;
    readonly name: string | undefined;
    /** Every location of the website, by name (for the places the person is sent to). */
    readonly places?: readonly LocationNameView[];
  },
): TeamMemberSummaryView {
  const { location, name, places = [] } = context;
  return {
    id: employee.id,
    name: name ?? employee.name,
    weekly: toWeekInput(weekOf(employee, location)),
    absences: absencesOf(employee).map(({ from, to }) => ({
      from: formatLocalDate(from),
      to: formatLocalDate(to),
    })),
    coverage: coverageViews(employee, places),
    qualifications: qualificationsOfEmployee(employee),
    version: instantToDate(employee.updatedAt).toISOString(),
  };
}

/** One calendar as its form edits it, with the version a change must name. */
export function toTeamMemberView(
  employee: StoredEmployee,
  context: {
    readonly websiteId: string;
    readonly location: StoredLocation;
    readonly name: string | undefined;
    readonly knownQualifications: readonly string[];
    /** Every location of the website, by name. */
    readonly places: readonly LocationNameView[];
  },
): TeamMemberView {
  const { location } = context;
  return {
    ...toTeamMemberSummary(employee, {
      location,
      name: context.name,
      places: context.places,
    }),
    websiteId: context.websiteId,
    location: { id: location.id, name: location.name },
    coverageChoices: context.places.filter(({ id }) => id !== location.id),
    locationWeekly: toWeekInput(location.openingHours.weekly),
    knownQualifications: context.knownQualifications,
  };
}
