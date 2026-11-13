import { toEpochDay } from '../time/local-date';

import type { BookingLocationId } from './ids';
import type { LocalDate } from '../time/local-date';

/**
 * Temporary work of an employee at another location: from one day to another (both included) the
 * person works at `locationId` and not at their own. The calendar stays one, at one location (EX-19);
 * a spell only says where that calendar is used on certain days, so the person's hours, absences and
 * qualifications are the same wherever they are, and no booking can ever hold them in two places at
 * once. Preferences for a first and second location become meaningful through it: a person ranks the
 * places they can be sent to.
 */
export interface CoverageSpell {
  readonly locationId: BookingLocationId;
  readonly from: LocalDate;
  readonly to: LocalDate;
}

/** Most spells one calendar keeps (past ones are cleared by the manager). */
export const MAX_COVERAGE_SPELLS = 50;

const isDuring = (spell: CoverageSpell, date: LocalDate) =>
  toEpochDay(spell.from) <= toEpochDay(date) && toEpochDay(date) <= toEpochDay(spell.to);

/** The spell that holds the person at another location on `date`, if any. */
export function coverageOn(
  spells: readonly CoverageSpell[],
  date: LocalDate,
): CoverageSpell | undefined {
  return spells.find((spell) => isDuring(spell, date));
}

/** Whether two spells share a day: a person is in one place on a day, so they may not. */
export function spellsOverlap(a: CoverageSpell, b: CoverageSpell): boolean {
  return toEpochDay(a.from) <= toEpochDay(b.to) && toEpochDay(b.from) <= toEpochDay(a.to);
}

/** The person whose place on a day is asked about: their own location and where they are sent. */
export interface Placed {
  readonly locationId: BookingLocationId | null;
  readonly coverage: readonly CoverageSpell[];
}

/**
 * Whether the person works at `locationId` on `date`: where a spell sends them that day, otherwise
 * their own location. A resource without a location of its own (a shared room) is everywhere.
 */
export function isWorkingAt(
  person: Placed,
  locationId: BookingLocationId,
  date: LocalDate,
): boolean {
  const spell = coverageOn(person.coverage, date);
  if (spell !== undefined) {
    return spell.locationId === locationId;
  }
  return person.locationId === null || person.locationId === locationId;
}

/** Whether any spell sends the person to `locationId`, on whatever days. */
export function isSentTo(person: Pick<Placed, 'coverage'>, locationId: BookingLocationId): boolean {
  return person.coverage.some((spell) => spell.locationId === locationId);
}
