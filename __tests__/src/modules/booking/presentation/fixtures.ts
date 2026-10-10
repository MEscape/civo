import type { SlotDto } from '@modules/booking/presentation/dto/availability-dto';
import type { BookingDto, HoldDto } from '@modules/booking/presentation/dto/booking-dto';
import type { CalendarBookingDto } from '@modules/booking/presentation/dto/calendar-dto';
import type {
  PublicCatalogDto,
  PublicLocationDto,
  PublicServiceDto,
} from '@modules/booking/presentation/dto/catalog-dto';
import type {
  BookingSetupDto,
  LocationDto,
  ResourceDto,
  ServiceDto,
} from '@modules/booking/presentation/dto/setup-dto';

export const BERLIN: PublicLocationDto = {
  id: 'loc-berlin',
  name: 'Town hall',
  address: 'Marktplatz 1',
  timeZone: 'Europe/Berlin',
};

export const ANNEX: PublicLocationDto = {
  id: 'loc-annex',
  name: 'Annex',
  address: 'Nebenstraße 2',
  timeZone: 'Europe/Berlin',
};

export function service(overrides: Partial<PublicServiceDto> = {}): PublicServiceDto {
  return {
    id: 'svc-passport',
    name: 'Passport',
    description: 'Apply for a passport.',
    category: 'citizen-services',
    durationMinutes: 20,
    locations: [BERLIN],
    maxParticipantsPerBooking: 1,
    information: [
      { field: 'firstName', isRequired: true },
      { field: 'lastName', isRequired: true },
      { field: 'email', isRequired: true },
      { field: 'phone', isRequired: false },
    ],
    requiredDocuments: ['Photo ID'],
    instructions: 'Please arrive five minutes early.',
    horizonDays: 60,
    cancellationAllowed: true,
    cancellationDeadlineMinutes: 1440,
    ...overrides,
  };
}

export const COURSE = service({
  id: 'svc-course',
  name: 'Swimming course',
  category: 'sports',
  locations: [BERLIN, ANNEX],
  maxParticipantsPerBooking: 4,
});

export function catalog(...services: PublicServiceDto[]): PublicCatalogDto {
  return { services };
}

export function slot(localDate: string, localTime: string, remaining = 1): SlotDto {
  const start = `${localDate}T${localTime}:00.000Z`;
  return {
    start,
    end: new Date(new Date(start).getTime() + 20 * 60_000).toISOString(),
    localDate,
    localTime,
    remainingParticipants: remaining,
  };
}

export function hold(overrides: Partial<HoldDto> = {}): HoldDto {
  return {
    holdId: 'hold-1',
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    start: '2026-10-12T08:00:00.000Z',
    end: '2026-10-12T08:20:00.000Z',
    localDate: '2026-10-12',
    localTime: '10:00',
    participants: 1,
    timeZone: 'Europe/Berlin',
    serviceName: 'Passport',
    locationName: 'Town hall',
    ...overrides,
  };
}

export function booking(overrides: Partial<BookingDto> = {}): BookingDto {
  return {
    reference: 'BK-ABCD-2345',
    status: 'confirmed',
    serviceId: 'svc-passport',
    serviceName: 'Passport',
    locationId: 'loc-berlin',
    locationName: 'Town hall',
    locationAddress: 'Marktplatz 1',
    timeZone: 'Europe/Berlin',
    start: '2026-10-12T08:00:00.000Z',
    end: '2026-10-12T08:20:00.000Z',
    localDate: '2026-10-12',
    localTime: '10:00',
    participants: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.org',
    requiredDocuments: ['Photo ID'],
    instructions: null,
    canCancel: true,
    canReschedule: true,
    rescheduleCount: 0,
    ...overrides,
  };
}

// ── Administration ──────────────────────────────────────────────────────────

const WORKDAY = { intervals: [{ start: '08:00', end: '16:00' }], breaks: [] };
const CLOSED = { intervals: [], breaks: [] };

export const OPENING_HOURS = {
  weekly: [WORKDAY, WORKDAY, WORKDAY, WORKDAY, WORKDAY, CLOSED, CLOSED],
  exceptions: [],
};

export function locationDto(overrides: Partial<LocationDto> = {}): LocationDto {
  return {
    id: 'loc-berlin',
    websiteId: 'site-1',
    name: 'Town hall',
    address: 'Marktplatz 1',
    timeZone: 'Europe/Berlin',
    openingHours: OPENING_HOURS,
    isActive: true,
    ...overrides,
  };
}

export function resourceDto(overrides: Partial<ResourceDto> = {}): ResourceDto {
  return {
    id: 'res-desk',
    websiteId: 'site-1',
    locationId: 'loc-berlin',
    name: 'Desk 1',
    type: 'service-desk',
    skills: ['passport'],
    capacity: null,
    availability: null,
    isActive: true,
    ...overrides,
  };
}

export function serviceDto(overrides: Partial<ServiceDto> = {}): ServiceDto {
  return {
    id: 'svc-passport',
    websiteId: 'site-1',
    name: 'Passport',
    description: null,
    category: 'citizen-services',
    isActive: true,
    durationMinutes: 20,
    preparationMinutes: 0,
    cleanupMinutes: 5,
    slotIntervalMinutes: 15,
    locationIds: ['loc-berlin'],
    requirements: [
      { resourceType: 'service-desk', skills: ['passport'], count: 1, resourceIds: null },
    ],
    participantsPerBooking: 1,
    participantsPerSession: 1,
    noticeMinutes: 60,
    horizonDays: 60,
    availability: null,
    cancellation: { isAllowed: true, deadlineMinutes: 1440, allowedActors: ['customer', 'staff'] },
    rescheduling: { isAllowed: true, deadlineMinutes: 1440, allowedActors: ['customer', 'staff'] },
    information: [
      { field: 'firstName', isRequired: true },
      { field: 'lastName', isRequired: true },
      { field: 'email', isRequired: true },
    ],
    requiredDocuments: [],
    instructions: null,
    ...overrides,
  };
}

export function setupDto(overrides: Partial<BookingSetupDto> = {}): BookingSetupDto {
  return {
    locations: [locationDto()],
    resources: [resourceDto()],
    services: [serviceDto()],
    ...overrides,
  };
}

export function calendarBooking(overrides: Partial<CalendarBookingDto> = {}): CalendarBookingDto {
  return {
    id: 'bk-1',
    reference: 'BK-ABCD-2345',
    status: 'confirmed',
    serviceId: 'svc-passport',
    serviceName: 'Passport',
    locationId: 'loc-berlin',
    resourceIds: ['res-desk'],
    start: '2026-10-12T08:00:00.000Z',
    end: '2026-10-12T08:20:00.000Z',
    startLocal: '2026-10-12T10:00:00',
    endLocal: '2026-10-12T10:20:00',
    participants: 1,
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.org',
    customerPhone: null,
    notes: null,
    cancelledBy: null,
    rescheduleCount: 0,
    ...overrides,
  };
}
