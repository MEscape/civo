import { notFound } from 'next/navigation';

import { orNotFound } from '@lib/errors/or-not-found';

import type { BookingReaders } from './booking-readers';

/** Reads the calendars of one location and the members who could be given one. */
export function loadTeamAdministration(
  input: { readonly websiteId: string; readonly locationId: string },
  queries: BookingReaders,
) {
  return orNotFound(queries.getTeam.execute(input));
}

/** Reads one calendar; one that belongs to another location is "not found" at this address. */
export async function loadTeamMember(
  input: { readonly websiteId: string; readonly locationId: string; readonly employeeId: string },
  queries: BookingReaders,
) {
  const member = await orNotFound(
    queries.getTeamMember.execute({ websiteId: input.websiteId, employeeId: input.employeeId }),
  );
  if (member.location.id !== input.locationId) {
    notFound();
  }
  return member;
}

/** Reads the signed-in employee's own calendar; `null` while no manager has set it up. */
export function loadOwnProfile(websiteId: string, queries: BookingReaders) {
  return orNotFound(queries.getOwnProfile.execute({ websiteId }));
}
