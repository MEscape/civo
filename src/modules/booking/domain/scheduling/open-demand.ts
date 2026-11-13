import { listCovers, listOverlaps, mergeIntervals } from '../time/time-interval';

import type { ResourceSchedule } from './scheduling-types';
import type { TimeInterval } from '../time/time-interval';

/**
 * A unit of an existing booking that waits for an employee (BD-07): it holds nobody yet, but one of
 * `candidateIds` will have to take it. A new booking may not count on an employee who an open unit is
 * already going to need, or two bookings could be made at one time with a single employee to serve both.
 */
export interface OpenDemand {
  /** What the unit holds its employee for: appointment and the service's buffers. */
  readonly span: TimeInterval;
  /** The employees who could take it: qualified, working through the whole span and not taken then. */
  readonly candidateIds: readonly string[];
}

/** The open unit that holds `span`, with the `resources` that are able to serve it and free for all of it. */
export function openDemandOf(
  span: TimeInterval,
  resources: readonly ResourceSchedule[],
): OpenDemand {
  return {
    span,
    candidateIds: resources
      .filter(
        (resource) =>
          listCovers(mergeIntervals(resource.availability), span) &&
          !listOverlaps(mergeIntervals(resource.busy), span),
      )
      .map(({ id }) => id),
  };
}
