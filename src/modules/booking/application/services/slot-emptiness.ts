import { formatLocalDate } from '../../domain/time/local-date';
import { wallClockOf } from '../../domain/time/time-zone';

import type { ServiceRequirement } from '../../domain/models/bookable-service';
import type { Scheduling } from '../../domain/scheduling/scheduling-types';

/**
 * Why a day offers no start, for the manager who looks for one: the location (or the service) is not
 * open that day, or something the service needs does not exist at the place (nobody has a calendar, no
 * resource of the kind is on), or everything that could serve it is taken. The first that applies.
 */
export type SlotEmptiness = 'closed' | 'no-employee' | 'no-resource' | 'fully-booked';

/** Whether the scheduling has an open stretch that starts or ends on its (first) day. */
function isOpenOn(scheduling: Scheduling): boolean {
  const day = formatLocalDate(scheduling.range.from);
  return scheduling.openWindows.some(
    (window) =>
      formatLocalDate(wallClockOf(window.start, scheduling.zone).date) === day ||
      formatLocalDate(wallClockOf(window.end, scheduling.zone).date) === day,
  );
}

/** Says why `scheduling` (one day) has no start; only meaningful when it has none. */
export function whyNoSlots(
  scheduling: Scheduling,
  requirements: readonly ServiceRequirement[],
): SlotEmptiness {
  if (!isOpenOn(scheduling)) {
    return 'closed';
  }
  const lacking = scheduling.pools.findIndex((pool) => pool.resources.length < pool.count);
  if (lacking >= 0) {
    return requirements[lacking]?.resourceType === 'employee' ? 'no-employee' : 'no-resource';
  }
  return 'fully-booked';
}
