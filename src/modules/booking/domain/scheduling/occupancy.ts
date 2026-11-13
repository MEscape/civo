import { addMinutes, subtractMinutes } from '../time/instant';

import { appointmentAt, occupiedSpanOf } from './slot-rules';

import type { SlotRules } from './slot-rules';
import type { Instant } from '../time/instant';
import type { Minutes } from '../time/minutes';
import type { TimeInterval } from '../time/time-interval';

/** How long a party is held before and after the appointment it takes part in. */
export interface Margins {
  readonly before: Minutes;
  readonly after: Minutes;
}

/** What decides a resource's margins: whether it is a person, and its own setup and teardown. */
export interface OccupancySubject {
  readonly id: string;
  readonly isEmployee: boolean;
  readonly setupMinutes: Minutes;
  readonly teardownMinutes: Minutes;
}

/**
 * Who is held for how long. An employee is held for the service's preparation, the appointment and
 * its clean-up. A room, a desk or a device is held for the appointment plus ITS OWN setup and
 * teardown, whatever the staff buffers of the service say.
 */
export function marginsOf(subject: OccupancySubject, rules: SlotRules): Margins {
  return subject.isEmployee
    ? { before: rules.preparationMinutes, after: rules.cleanupMinutes }
    : { before: subject.setupMinutes, after: subject.teardownMinutes };
}

/** The appointment widened by the margins: the span a party must be free and working for. */
export function spanWithMargins(appointment: TimeInterval, margins: Margins): TimeInterval {
  return {
    start: subtractMinutes(appointment.start, margins.before),
    end: addMinutes(appointment.end, margins.after),
  };
}

/** The smallest span that holds every given span. */
export function hullOf(spans: readonly TimeInterval[]): TimeInterval | null {
  const first = spans[0];
  if (first === undefined) {
    return null;
  }
  return spans.reduce(
    (hull, span) => ({
      start: span.start < hull.start ? span.start : hull.start,
      end: span.end > hull.end ? span.end : hull.end,
    }),
    first,
  );
}

export interface PartySpan {
  readonly id: string;
  readonly span: TimeInterval;
}

/** Who is occupied when, for an appointment at one start. */
export interface Occupancy {
  /** What the citizen sees: the appointment alone. */
  readonly citizen: TimeInterval;
  /** What an employee of the service is held for. */
  readonly employee: TimeInterval;
  /** What each given resource is held for, in the order given. */
  readonly resources: readonly PartySpan[];
  /** The appointment and every given resource's span together: what a booking as a whole covers. */
  readonly hull: TimeInterval;
}

/**
 * The one answer to "who is occupied when": the slot engine holds every resource for the span given
 * here, a booking stores those spans, and the service form previews them, so what the manager sees
 * is what the engine does. Pure: the start, the rules and the resources in, spans out.
 */
export function occupancyOf(
  start: Instant,
  rules: SlotRules,
  resources: readonly OccupancySubject[],
): Occupancy {
  const citizen = appointmentAt(start, rules);
  const employee = occupiedSpanOf(citizen, rules);
  const parties = resources.map((resource) => ({
    id: resource.id,
    span: spanWithMargins(citizen, marginsOf(resource, rules)),
  }));
  const hull = hullOf([citizen, ...parties.map((party) => party.span)]) ?? citizen;
  return { citizen, employee, resources: parties, hull };
}
