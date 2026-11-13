import type { Margins } from './occupancy';
import type { OpenDemand } from './open-demand';
import type { SlotRules } from './slot-rules';
import type { StartWindow } from './start-window';
import type { Instant } from '../time/instant';
import type { LocalDateRange } from '../time/local-date-range';
import type { TimeInterval } from '../time/time-interval';
import type { TimeZone } from '../time/time-zone';

/**
 * One resource as the engine sees it: when it works and when it is already taken. The engine knows
 * nothing of employees, rooms or qualifications; the caller decides which resources may serve a
 * requirement and hands in only those.
 */
export interface ResourceSchedule {
  /** Opaque and unique: the same id in two requirements is the same resource, used at most once. */
  readonly id: string;
  /** When the resource may work: opening or working hours minus absences and blocks. */
  readonly availability: readonly TimeInterval[];
  /** The occupied spans (appointment plus its buffers) of bookings and holds that already use it. */
  readonly busy: readonly TimeInterval[];
  /**
   * How long it is held before and after an appointment (`marginsOf`). Absent: like staff, for the
   * service's own preparation and clean-up.
   */
  readonly margins?: Margins;
}

/** `count` resources, all different, out of `resources`, needed for the whole occupied span. */
export interface ResourceRequirement {
  readonly count: number;
  readonly resources: readonly ResourceSchedule[];
}

/** Everything one scheduling question needs: plain data in, plain answers out. */
export interface SchedulingInput {
  /** The zone of the location. The start grid is on its wall clock. */
  readonly zone: TimeZone;
  /** The local days on which starts are listed by `findSlots`. */
  readonly range: LocalDateRange;
  readonly rules: SlotRules;
  /** Notice and horizon (`createStartWindow`). */
  readonly startWindow: StartWindow;
  /** When the place is open for appointments; an appointment must lie inside one window. */
  readonly openWindows: readonly TimeInterval[];
  /** May be empty: a service that needs no resource is bookable whenever the place is open. */
  readonly requirements: readonly ResourceRequirement[];
  /**
   * The open units of other bookings that will need one of the same employees (`openDemandOf`).
   * They take no part in the answer except to use up a resource a new booking would count on.
   */
  readonly openDemands?: readonly OpenDemand[];
}

/** The candidates for `count` units of one requirement. Their lists are normalized and sorted by id. */
export interface ResourcePool {
  readonly count: number;
  readonly resources: readonly ResourceSchedule[];
}

/** `SchedulingInput` checked and normalized once (`prepareScheduling`), so each candidate is judged cheaply. */
export interface Scheduling {
  readonly zone: TimeZone;
  readonly range: LocalDateRange;
  readonly rules: SlotRules;
  readonly startWindow: StartWindow;
  readonly openWindows: readonly TimeInterval[];
  readonly pools: readonly ResourcePool[];
  readonly openDemands: readonly OpenDemand[];
}

/** A start that can be booked, with the resources that make it bookable. */
export interface PlannedSlot {
  readonly start: Instant;
  /** End of the appointment, not of the clean-up. */
  readonly end: Instant;
  /** The appointment and what every resource is held for around it: the span the booking covers. */
  readonly occupied: TimeInterval;
  /** What each resource of `resourceIds` is held for: the appointment plus its own margins. */
  readonly resourceSpans: Readonly<Record<string, TimeInterval>>;
  /** One id per unit of every requirement, sorted. */
  readonly resourceIds: readonly string[];
  /**
   * The same ids grouped by requirement, in the order of `SchedulingInput.requirements`, one id per
   * unit: which resource serves which requirement.
   */
  readonly requirementResourceIds: ReadonlyArray<readonly string[]>;
}

/** Why a start cannot be booked. Checked in this order, so the reason is the first that applies. */
export type SlotRejection =
  'off-grid' | 'outside-start-window' | 'outside-open-hours' | 'resources-unavailable';

export type SlotAssessment =
  | { readonly kind: 'planned'; readonly slot: PlannedSlot }
  | { readonly kind: 'rejected'; readonly reason: SlotRejection };
