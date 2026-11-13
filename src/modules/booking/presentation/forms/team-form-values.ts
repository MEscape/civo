import { deepEqual } from '@lib/utils';

import type { DayDto } from '../dto/location-dto';
import type { TeamMemberDto } from '../dto/team-dto';
import type { TeamMemberFormValues } from '../schemas/team-schema';

const copyOf = ({ intervals, breaks }: DayDto) => ({
  intervals: intervals.map((range) => ({ ...range })),
  breaks: breaks.map((range) => ({ ...range })),
});

/** A calendar as its form edits it: the week, the absences as closed day ranges, the qualifications and the cover at other locations. */
export function toTeamMemberFormValues(member: TeamMemberDto): TeamMemberFormValues {
  return {
    openingHours: {
      weekly: member.weekly.map(copyOf),
      exceptions: member.absences.map(({ from, to }) => ({ kind: 'closed' as const, from, to })),
    },
    qualifications: [...member.qualifications],
    coverage: member.coverage.map(({ locationId, from, to }) => ({ locationId, from, to })),
  };
}

/** Whether a change can take time away from existing bookings, so they have to be looked at first. */
export function changesTime(values: TeamMemberFormValues, initial: TeamMemberFormValues): boolean {
  return (
    !deepEqual(values.openingHours, initial.openingHours) ||
    !deepEqual(values.coverage, initial.coverage)
  );
}
