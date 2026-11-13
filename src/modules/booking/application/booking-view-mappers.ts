import { assignmentStateOf } from '../domain/assignment/booking-assignment';
import { evaluateCancellation, evaluateRescheduling } from '../domain/policies/change-policy';
import { subtractMinutes } from '../domain/time/instant';
import { formatInstantInZone } from '../domain/time/instant-format';

import type {
  BookingView,
  EmployeeBookingView,
  FitView,
  OwnChangeView,
  PublicBookingView,
  SlotView,
} from './contracts/booking-views';
import type { Fit } from '../domain/assignment/assignment-fit';
import type { BookableService, ChangePolicy } from '../domain/models/bookable-service';
import type { Booking } from '../domain/models/booking';
import type { WebsiteId } from '../domain/models/ids';
import type { ChangeDenial } from '../domain/policies/change-policy';
import type { BookingLocationFacts } from '../domain/ports/booking-location.repository';
import type { StoredBooking } from '../domain/ports/booking.repository';
import type { Instant } from '../domain/time/instant';
import type { TimeInterval } from '../domain/time/time-interval';
import type { TimeZone } from '../domain/time/time-zone';

/** An instant as the text a screen draws, on the wall clock of the location. */
const at = (instant: Instant, zone: TimeZone) => formatInstantInZone(instant, zone);

const optionalAt = (instant: Instant | null, zone: TimeZone) =>
  instant === null ? null : at(instant, zone);

/** What an employee may see of a booking: every fact of it but the customer. */
export function toEmployeeBookingView(
  { booking, placement }: StoredBooking,
  zone: TimeZone,
  websiteId: WebsiteId,
): EmployeeBookingView {
  return {
    websiteId,
    id: booking.id,
    reference: placement.reference,
    status: booking.status,
    serviceId: booking.serviceId,
    locationId: booking.locationId,
    timeZone: zone,
    start: at(booking.start, zone),
    end: at(booking.end, zone),
    units: booking.assignments.map((unit) => ({
      requirementIndex: unit.requirementIndex,
      resourceType: unit.resourceType,
      resourceId: unit.resourceId,
    })),
    // A conflict is computed against the current setup (`findAffectedBookings`), not stored, so a
    // stored booking is `open` or `assigned`.
    assignment: assignmentStateOf(booking, false) === 'open' ? 'open' : 'assigned',
    holdExpiresAt: optionalAt(booking.holdExpiresAt, zone),
    rescheduleCount: booking.rescheduleCount,
    cancelledAt: optionalAt(booking.cancelledAt, zone),
    createdAt: at(booking.createdAt, zone),
  };
}

/** What a manager sees of a booking, the customer's details included. */
export function toBookingView(
  stored: StoredBooking,
  zone: TimeZone,
  websiteId: WebsiteId,
): BookingView {
  return { ...toEmployeeBookingView(stored, zone, websiteId), customer: stored.booking.customer };
}

/** What the service's policy lets the visitor do with a booking, now and until when. */
function ownChangeOf(
  policy: ChangePolicy,
  denial: ChangeDenial | null,
  { booking, zone }: { readonly booking: Booking; readonly zone: TimeZone },
): OwnChangeView {
  const customerMay = policy.isAllowed && policy.allowedActors.includes('customer');
  return {
    isAllowed: booking.status === 'confirmed' && denial === null,
    until: customerMay ? at(subtractMinutes(booking.start, policy.deadlineMinutes), zone) : null,
  };
}

/** Where a visitor's booking is read from: its service, its location and the moment of asking. */
export interface PublicBookingContext {
  readonly service: BookableService;
  readonly location: BookingLocationFacts;
  readonly now: Instant;
}

/** What a visitor sees of their own booking, with what they may still change. */
export function toPublicBookingView(
  { booking, placement }: StoredBooking,
  { service, location, now }: PublicBookingContext,
  websiteId: WebsiteId,
): PublicBookingView {
  const zone = location.zone;
  const attempt = { actor: 'customer', now } as const;
  return {
    websiteId,
    id: booking.id,
    reference: placement.reference,
    status: booking.status,
    serviceId: booking.serviceId,
    serviceName: placement.snapshot?.serviceName ?? service.name,
    locationId: booking.locationId,
    locationName: location.name,
    locationAddress: location.address,
    timeZone: zone,
    start: at(booking.start, zone),
    end: at(booking.end, zone),
    holdExpiresAt: optionalAt(booking.holdExpiresAt, zone),
    rescheduleCount: booking.rescheduleCount,
    cancellation: ownChangeOf(
      service.cancellation,
      evaluateCancellation(service, booking, attempt),
      { booking, zone },
    ),
    rescheduling: ownChangeOf(
      service.rescheduling,
      evaluateRescheduling(service, booking, attempt),
      { booking, zone },
    ),
  };
}

export function toSlotView(slot: TimeInterval, zone: TimeZone): SlotView {
  return { start: at(slot.start, zone), end: at(slot.end, zone) };
}

export function toFitView(fit: Fit): FitView {
  return { level: fit.level, reasons: fit.reasons };
}
