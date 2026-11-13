import type {
  IneligibilityReason,
  AssignmentCandidate,
} from '../assignment/assignment-eligibility';
import type { ReleaseDenial } from '../assignment/booking-assignment';
import type { BookingAction } from '../lifecycle/booking-actions';
import type { ChangeActor, BookableService } from '../models/bookable-service';
import type { Booking, BookingStatus } from '../models/booking';
import type { BookableResourceId, BookingLocationId } from '../models/ids';
import type { ChangeDenial } from '../policies/change-policy';
import type { BookingChannel } from '../policies/service-policy';
import type { Scheduling, SlotRejection } from '../scheduling/scheduling-types';
import type { Instant } from '../time/instant';

/**
 * A change somebody proposes, with the data needed to examine it. Only what is supplied is
 * examined: a missing `scheduling` or `candidate` is reported in `unchecked`, never assumed fine.
 *
 * `scheduling` is the scheduling engine's question for the booking's service and location, with
 * the resources' `busy` lists WITHOUT this booking (it must not conflict with itself) and with the
 * start window of whoever acts (a customer's notice and horizon, a manager's none).
 *
 * Moving a booking to another service or location is not a change: it is a cancellation and a new
 * booking, as it always was.
 */
export type ProposedChange =
  | {
      readonly kind: 'create';
      readonly locationId: BookingLocationId;
      readonly channel: BookingChannel;
      readonly start: Instant;
      readonly scheduling: Scheduling | null;
    }
  | { readonly kind: 'cancel'; readonly booking: Booking; readonly actor: ChangeActor }
  | {
      readonly kind: 'reschedule';
      readonly booking: Booking;
      readonly actor: ChangeActor;
      readonly start: Instant;
      readonly scheduling: Scheduling | null;
    }
  | {
      readonly kind: 'assign';
      readonly booking: Booking;
      readonly requirementIndex: number;
      readonly candidate: AssignmentCandidate | null;
    }
  | {
      readonly kind: 'unassign';
      readonly booking: Booking;
      readonly resourceId: BookableResourceId;
    };

/** What the analysis reads besides the change: the service and the reference instant. */
export interface ImpactContext {
  readonly service: BookableService;
  readonly now: Instant;
}

/** Something that makes the change impossible. */
export type Violation =
  | { readonly code: 'service-inactive' }
  | { readonly code: 'location-not-offered' }
  | {
      readonly code: 'status-not-allowed';
      readonly status: BookingStatus;
      readonly action: BookingAction;
    }
  | {
      readonly code: 'change-refused';
      readonly change: 'cancellation' | 'rescheduling';
      readonly denial: ChangeDenial;
    }
  | { readonly code: 'slot-rejected'; readonly reason: SlotRejection }
  /** The schedule was built for another service: the operations would refuse the slot. */
  | { readonly code: 'slot-does-not-fit-service' }
  | { readonly code: 'requirement-unknown' }
  | { readonly code: 'not-eligible'; readonly reasons: readonly IneligibilityReason[] }
  | { readonly code: 'no-open-unit' }
  | { readonly code: ReleaseDenial };

/** A consequence that does not block the change but that the person should know about. */
export type Warning =
  /** The visitor is told by e-mail when somebody else cancels or moves their booking. */
  | { readonly code: 'customer-notified' }
  | { readonly code: 'employees-released'; readonly resourceIds: readonly BookableResourceId[] }
  | {
      readonly code: 'employees-change';
      readonly before: readonly BookableResourceId[];
      readonly after: readonly BookableResourceId[];
    };

/** Something that was not examined because its input was not supplied. */
export type UncheckedAspect = 'slot' | 'eligibility';

/**
 * The consequences of a proposed change. `isBlocked` is true when any violation exists. It being
 * false means "nothing found in what was examined": when `unchecked` is not empty, the change is not
 * approved, only not refused.
 */
export interface ImpactAnalysis {
  readonly isBlocked: boolean;
  readonly violations: readonly Violation[];
  readonly warnings: readonly Warning[];
  readonly unchecked: readonly UncheckedAspect[];
}
