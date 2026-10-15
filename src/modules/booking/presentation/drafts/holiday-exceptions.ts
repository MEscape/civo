import {
  AVAILABILITY_LIMITS,
  publicHolidaysOf,
} from '../../application/contracts/booking-constraints';

import type { ExceptionForm } from './availability-plan-form';
import type { GermanRegion, HolidayKey } from '../../application/contracts/booking-constraints';

/** What importing a holiday would do to the plan. */
export type ProposalStatus =
  /** A closure for this day is added. */
  | 'new'
  /** The plan has this day as an imported holiday already; it is replaced by this state's. */
  | 'replaces'
  /** An exception somebody entered covers this day; it stays and the holiday is not added. */
  | 'covered';

export interface HolidayProposal {
  readonly key: HolidayKey;
  readonly date: string;
  readonly status: ProposalStatus;
}

/** An exception with its place in the plan, because a list shown in groups is edited by that place. */
export interface IndexedException {
  readonly exception: ExceptionForm;
  readonly index: number;
}

/** The imported holidays of one state in one year, which are added, replaced and removed together. */
export interface HolidayGroup {
  readonly region: GermanRegion;
  readonly year: number;
  readonly entries: readonly IndexedException[];
}

function yearOf(date: string): number {
  return Number(date.slice(0, 'YYYY'.length));
}

function isHolidayOfYear(exception: ExceptionForm, year: number): boolean {
  return (
    exception.holiday !== undefined && exception.holiday !== null && yearOf(exception.from) === year
  );
}

function covers(exception: ExceptionForm, date: string): boolean {
  return (
    exception.from !== '' && exception.from <= date && date <= (exception.to || exception.from)
  );
}

/**
 * What importing the holidays of a state and year would do, day by day. The
 * holidays already imported for that year are what is replaced, whichever
 * state they were for, so switching state is one step; a day somebody entered
 * by hand is never touched and the holiday on it is not added.
 */
export function holidayProposals(
  region: GermanRegion,
  year: number,
  existing: readonly ExceptionForm[],
): readonly HolidayProposal[] {
  const kept = existing.filter((exception) => !isHolidayOfYear(exception, year));
  const replaced = new Set(
    existing.filter((exception) => isHolidayOfYear(exception, year)).map((e) => e.from),
  );
  return publicHolidaysOf(region, year).map((holiday) => {
    let status: ProposalStatus = 'new';
    if (kept.some((exception) => covers(exception, holiday.date))) {
      status = 'covered';
    } else if (replaced.has(holiday.date)) {
      status = 'replaces';
    }
    return { key: holiday.key, date: holiday.date, status };
  });
}

/**
 * The plan with the holidays of that year swapped for the proposed ones, as
 * closures that remember where they came from. The plan keeps its limit: what
 * does not fit is left out at the end, never dropped from the middle (the
 * importer says so before it is applied).
 */
export function withHolidayClosures(
  existing: readonly ExceptionForm[],
  {
    region,
    year,
    proposals,
  }: {
    readonly region: GermanRegion;
    readonly year: number;
    readonly proposals: readonly HolidayProposal[];
  },
): readonly ExceptionForm[] {
  const kept = existing.filter((exception) => !isHolidayOfYear(exception, year));
  const room = Math.max(0, AVAILABILITY_LIMITS.maxExceptions - kept.length);
  const added = proposals
    .filter((proposal) => proposal.status !== 'covered')
    .slice(0, room)
    .map((proposal): ExceptionForm => ({
      kind: 'closed',
      from: proposal.date,
      to: proposal.date,
      label: null,
      holiday: { key: proposal.key, region },
    }));
  return [...kept, ...added];
}

/** How many closures importing would add, and whether the plan has room for them all. */
export function importSize(
  existing: readonly ExceptionForm[],
  year: number,
  proposals: readonly HolidayProposal[],
): { readonly count: number; readonly isOverLimit: boolean } {
  const kept = existing.filter((exception) => !isHolidayOfYear(exception, year)).length;
  const count = proposals.filter((proposal) => proposal.status !== 'covered').length;
  return { count, isOverLimit: kept + count > AVAILABILITY_LIMITS.maxExceptions };
}

/** Splits a plan's exceptions into those entered by hand and the imported holidays, grouped by state and year. */
export function groupExceptions(exceptions: readonly ExceptionForm[]): {
  readonly own: readonly IndexedException[];
  readonly groups: readonly HolidayGroup[];
} {
  const own: IndexedException[] = [];
  const grouped = new Map<
    string,
    { region: GermanRegion; year: number; entries: IndexedException[] }
  >();
  exceptions.forEach((exception, index) => {
    const holiday = exception.holiday ?? null;
    if (holiday === null) {
      own.push({ exception, index });
      return;
    }
    const year = yearOf(exception.from);
    const key = `${holiday.region}-${year}`;
    const group = grouped.get(key) ?? { region: holiday.region, year, entries: [] };
    group.entries.push({ exception, index });
    grouped.set(key, group);
  });
  const groups = [...grouped.values()].sort(
    (a, b) => a.year - b.year || a.region.localeCompare(b.region),
  );
  return { own, groups };
}

/** The plan without the entries of one imported group. */
export function withoutGroup(
  exceptions: readonly ExceptionForm[],
  group: HolidayGroup,
): readonly ExceptionForm[] {
  const removed = new Set(group.entries.map((entry) => entry.index));
  return exceptions.filter((_, index) => !removed.has(index));
}

/** The region the holidays in a plan were imported for, so importing again starts from it. */
export function importedRegionOf(exceptions: readonly ExceptionForm[]): GermanRegion | null {
  return exceptions.find((exception) => exception.holiday)?.holiday?.region ?? null;
}
