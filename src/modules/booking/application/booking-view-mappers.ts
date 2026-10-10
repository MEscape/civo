import { toAvailabilityPlanInput } from '../domain/models/availability-plan';
import { checkCancellation, checkRescheduling } from '../domain/policies/change-policy';

import type { BookingView, HoldView } from './contracts/booking-views';
import type { CalendarBookingView } from './contracts/calendar-views';
import type {
  AvailabilityView,
  PublicLocationView,
  PublicServiceView,
  SlotView,
} from './contracts/catalog-views';
import type { LocationView, ResourceView, ServiceView } from './contracts/setup-views';
import type { BookableResource } from '../domain/models/bookable-resource';
import type { BookableService } from '../domain/models/bookable-service';
import type { Booking } from '../domain/models/booking';
import type { BookingLocation } from '../domain/models/booking-location';
import type { AvailableSlot } from '../domain/scheduling/scheduling-types';

export function toLocationView(location: BookingLocation): LocationView {
  return {
    id: location.id,
    websiteId: location.websiteId,
    name: location.name,
    address: location.address,
    timeZone: location.timeZone,
    openingHours: toAvailabilityPlanInput(location.openingHours),
    isActive: location.isActive,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
}

export function toResourceView(resource: BookableResource): ResourceView {
  return {
    id: resource.id,
    websiteId: resource.websiteId,
    locationId: resource.locationId,
    name: resource.name,
    type: resource.type,
    skills: resource.skills,
    capacity: resource.capacity,
    availability:
      resource.availability === null ? null : toAvailabilityPlanInput(resource.availability),
    isActive: resource.isActive,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  };
}

export function toServiceView(service: BookableService): ServiceView {
  return {
    id: service.id,
    websiteId: service.websiteId,
    name: service.name,
    description: service.description,
    category: service.category,
    isActive: service.isActive,
    durationMinutes: service.durationMinutes,
    preparationMinutes: service.preparationMinutes,
    cleanupMinutes: service.cleanupMinutes,
    slotIntervalMinutes: service.slotIntervalMinutes,
    locationIds: service.locationIds,
    requirements: service.requirements,
    participantsPerBooking: service.capacity.participantsPerBooking,
    participantsPerSession: service.capacity.participantsPerSession,
    noticeMinutes: service.noticeMinutes,
    horizonDays: service.horizonDays,
    availability:
      service.availability === null ? null : toAvailabilityPlanInput(service.availability),
    cancellation: service.cancellation,
    rescheduling: service.rescheduling,
    information: service.information,
    requiredDocuments: service.requiredDocuments,
    instructions: service.instructions,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

export function toPublicLocationView(location: BookingLocation): PublicLocationView {
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    timeZone: location.timeZone,
  };
}

/** What a visitor sees of a service: no resource requirements, no internal buffers, no staff policy. */
export function toPublicServiceView(
  service: BookableService,
  locations: readonly BookingLocation[],
): PublicServiceView {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    category: service.category,
    durationMinutes: service.durationMinutes,
    locations: locations.map(toPublicLocationView),
    maxParticipantsPerBooking: service.capacity.participantsPerBooking,
    information: service.information,
    requiredDocuments: service.requiredDocuments,
    instructions: service.instructions,
    horizonDays: service.horizonDays,
    cancellationAllowed:
      service.cancellation.isAllowed && service.cancellation.allowedActors.includes('customer'),
    cancellationDeadlineMinutes: service.cancellation.deadlineMinutes,
  };
}

export function toSlotView(slot: AvailableSlot): SlotView {
  return {
    start: new Date(slot.start),
    end: new Date(slot.end),
    remainingParticipants: slot.remainingParticipants,
  };
}

export function toAvailabilityView(
  { service, location }: { readonly service: BookableService; readonly location: BookingLocation },
  range: { readonly from: string; readonly to: string },
  slots: readonly AvailableSlot[],
): AvailabilityView {
  return {
    serviceId: service.id,
    locationId: location.id,
    timeZone: location.timeZone,
    from: range.from,
    to: range.to,
    slots: slots.map(toSlotView),
  };
}

export function toHoldView(
  booking: Booking,
  service: BookableService,
  location: BookingLocation,
): HoldView {
  return {
    holdId: booking.id,
    expiresAt: booking.holdExpiresAt ?? booking.createdAt,
    start: booking.start,
    end: booking.end,
    participants: booking.participants,
    timeZone: location.timeZone,
    serviceName: service.name,
    locationName: location.name,
  };
}

/** The visitor's own view of a booking, with what they may still do to it right now. */
export function toBookingView(
  {
    booking,
    service,
    location,
  }: {
    readonly booking: Booking;
    readonly service: BookableService;
    readonly location: BookingLocation;
  },
  now: Date,
): BookingView {
  const isStanding = booking.status === 'confirmed';
  return {
    reference: booking.reference,
    status: booking.status,
    serviceId: service.id,
    serviceName: service.name,
    locationId: location.id,
    locationName: location.name,
    locationAddress: location.address,
    timeZone: location.timeZone,
    start: booking.start,
    end: booking.end,
    participants: booking.participants,
    firstName: booking.customer?.firstName ?? null,
    lastName: booking.customer?.lastName ?? null,
    email: booking.customer?.email ?? null,
    requiredDocuments: service.requiredDocuments,
    instructions: service.instructions,
    canCancel: isStanding && checkCancellation(service, booking, { actor: 'customer', now }).isOk(),
    canReschedule:
      isStanding && checkRescheduling(service, booking, { actor: 'customer', now }).isOk(),
    rescheduleCount: booking.rescheduleCount,
  };
}

function customerName(booking: Booking): string | null {
  const parts = [booking.customer?.firstName, booking.customer?.lastName].filter(
    (part): part is string => part !== null && part !== undefined,
  );
  return parts.length > 0 ? parts.join(' ') : null;
}

export function toCalendarBookingView(booking: Booking, serviceName: string): CalendarBookingView {
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    serviceId: booking.serviceId,
    serviceName,
    locationId: booking.locationId,
    resourceIds: booking.resourceIds,
    start: booking.start,
    end: booking.end,
    occupiedStart: booking.occupiedStart,
    occupiedEnd: booking.occupiedEnd,
    participants: booking.participants,
    customerName: customerName(booking),
    customerEmail: booking.customer?.email ?? null,
    customerPhone: booking.customer?.phone ?? null,
    notes: booking.customer?.notes ?? null,
    cancelledBy: booking.cancelledBy,
    rescheduleCount: booking.rescheduleCount,
  };
}
