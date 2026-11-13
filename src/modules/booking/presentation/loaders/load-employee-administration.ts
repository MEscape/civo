import { cache } from 'react';

import { orNotFound } from '@lib/errors/or-not-found';
import { orNull } from '@lib/errors/or-null';

import { comingSpells } from '../forms/cover-spells';
import {
  parseDayPlanParams,
  parseMessagesParams,
  parseOpenListParams,
} from '../schemas/employee-schema';

import { loadOpenBookings } from './load-open-bookings';

import type { BookingReaders, RawSearchParams } from './booking-readers';

interface Input {
  readonly websiteId: string;
  readonly searchParams: RawSearchParams;
  readonly queries: BookingReaders;
}

/** Reads one day of the signed-in employee's plan. */
export function loadDayPlan({ websiteId, searchParams, queries }: Input) {
  return orNotFound(
    queries.getEmployeeDayPlan.execute({ websiteId, ...parseDayPlanParams(searchParams) }),
  );
}

/** Reads the open bookings the address asks for, and all of them (the filter's locations come from those). */
export async function loadOpenAdministration({ websiteId, searchParams, queries }: Input) {
  const view = parseOpenListParams(searchParams);
  const [all, filtered] = await Promise.all([
    orNotFound(loadOpenBookings(queries, websiteId)),
    orNotFound(
      queries.getOpenBookings.execute({
        websiteId,
        date: view.date,
        locationId: view.location,
        partOfDay: view.part,
      }),
    ),
  ]);
  return { view, all, filtered };
}

/** Reads a page of the signed-in employee's inbox. */
export function loadMessages({ websiteId, searchParams, queries }: Input) {
  return orNotFound(
    queries.listMessages.execute({ websiteId, ...parseMessagesParams(searchParams) }),
  );
}

/**
 * The signed-in employee's own calendar for what it says about where they work (their location and the days
 * they are sent elsewhere); `null` when they have none or may not read it.
 */
export const loadOwnPlaces = cache((websiteId: string, queries: BookingReaders) =>
  orNull(queries.getOwnProfile.execute({ websiteId })),
);

/** The spell of cover that is on today or starts within `daysAhead` days, soonest first; `null` when none. */
export async function loadComingCover(
  websiteId: string,
  queries: BookingReaders,
  daysAhead: number,
) {
  const profile = await loadOwnPlaces(websiteId, queries);
  const [spell] = profile === null ? [] : comingSpells(profile.coverage, profile.today, daysAhead);
  return spell === undefined || profile === null ? null : { spell, today: profile.today };
}

/** Reads the signed-in employee's preferences. */
export function loadPreferences(websiteId: string, queries: BookingReaders) {
  return orNotFound(queries.getEmployeePreferences.execute({ websiteId }));
}
