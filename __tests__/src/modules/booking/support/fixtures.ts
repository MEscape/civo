import { toTenantId } from '@modules/auth';
import { createAvailabilityPlan } from '@modules/booking/domain/models/availability-plan';
import type {
  AvailabilityExceptionInput,
  AvailabilityPlan,
  DayScheduleInput,
  TimeRangeInput,
} from '@modules/booking/domain/models/availability-plan';
import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import { bookingSessionKey, sharedSessionKey } from '@modules/booking/domain/models/booking';
import type { Booking } from '@modules/booking/domain/models/booking';
import type { BookingLocation } from '@modules/booking/domain/models/booking-location';
import { toBookingReference } from '@modules/booking/domain/models/booking-reference';
import {
  toBookableResourceId,
  toBookableServiceId,
  toBookingId,
  toBookingLocationId,
  toWebsiteId,
} from '@modules/booking/domain/models/ids';
import { buildSchedulingIndex } from '@modules/booking/domain/scheduling/scheduling-index';
import type {
  LocalDateRange,
  SchedulingInput,
} from '@modules/booking/domain/scheduling/scheduling-types';
import { parseLocalDate } from '@modules/booking/domain/time/local-date';
import type { LocalDate } from '@modules/booking/domain/time/local-date';
import { parseTimeZone, zonedTimeToEpoch } from '@modules/booking/domain/time/time-zone';
import type { TimeZone } from '@modules/booking/domain/time/time-zone';

export const TENANT = toTenantId('tenant-1');
export const WEBSITE = toWebsiteId('website-1');
export const LOCATION_ID = toBookingLocationId('location-1');
export const SERVICE_ID = toBookableServiceId('service-1');
export const BERLIN = zone('Europe/Berlin');
export const NEW_YORK = zone('America/New_York');

/** Monday 2027-01-04, 07:00 in Berlin: before the first opening hour of the week. */
export const NOW = new Date('2027-01-04T06:00:00Z');

export function zone(name: string): TimeZone {
  const parsed = parseTimeZone(name);
  if (parsed === null) {
    throw new Error(`Unknown zone ${name}`);
  }
  return parsed;
}

export function date(text: string): LocalDate {
  const parsed = parseLocalDate(text);
  if (parsed === null) {
    throw new Error(`Bad date ${text}`);
  }
  return parsed;
}

/** The instant of a wall-clock time in a zone: `at('2027-01-11', '09:30')`. */
export function at(day: string, time: string, inZone: TimeZone = BERLIN): number {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return zonedTimeToEpoch(date(day), hour * 60 + minute, inZone);
}

export function range(from: string, to: string): LocalDateRange {
  return { from: date(from), to: date(to) };
}

const CLOSED: DayScheduleInput = { intervals: [], breaks: [] };

export function hours(start: string, end: string, breaks: TimeRangeInput[] = []): DayScheduleInput {
  return { intervals: [{ start, end }], breaks };
}

/** Builds a plan; `days` is keyed by ISO weekday (1 = Monday). */
export function plan(
  days: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, DayScheduleInput>>,
  exceptions: AvailabilityExceptionInput[] = [],
): AvailabilityPlan {
  const weekly = ([1, 2, 3, 4, 5, 6, 7] as const).map((day) => days[day] ?? CLOSED);
  const result = createAvailabilityPlan({ weekly, exceptions });
  if (result.isErr()) {
    throw new Error(`Bad plan: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Monday to Friday, the same hours. */
export function weekdays(
  start: string,
  end: string,
  breaks: TimeRangeInput[] = [],
): AvailabilityPlan {
  const day = hours(start, end, breaks);
  return plan({ 1: day, 2: day, 3: day, 4: day, 5: day });
}

export function makeLocation(overrides: Partial<BookingLocation> = {}): BookingLocation {
  return {
    id: LOCATION_ID,
    tenantId: TENANT,
    websiteId: WEBSITE,
    name: 'Town hall',
    address: 'Main street 1',
    timeZone: BERLIN,
    openingHours: weekdays('08:00', '18:00'),
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeResource(
  id: string,
  overrides: Partial<BookableResource> = {},
): BookableResource {
  return {
    id: toBookableResourceId(id),
    tenantId: TENANT,
    websiteId: WEBSITE,
    locationId: null,
    name: id,
    type: 'employee',
    skills: [],
    capacity: null,
    availability: null,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const NO_CHANGE = {
  isAllowed: true,
  deadlineMinutes: 24 * 60,
  allowedActors: ['customer', 'staff'],
} as const;

export function makeService(overrides: Partial<BookableService> = {}): BookableService {
  return {
    id: SERVICE_ID,
    tenantId: TENANT,
    websiteId: WEBSITE,
    name: 'Passport application',
    description: null,
    category: null,
    isActive: true,
    durationMinutes: 30,
    preparationMinutes: 0,
    cleanupMinutes: 0,
    slotIntervalMinutes: 30,
    locationIds: [LOCATION_ID],
    requirements: [{ resourceType: 'employee', skills: [], count: 1, resourceIds: null }],
    capacity: { participantsPerBooking: 1, participantsPerSession: 1 },
    noticeMinutes: 0,
    horizonDays: 60,
    availability: null,
    cancellation: { ...NO_CHANGE, allowedActors: [...NO_CHANGE.allowedActors] },
    rescheduling: { ...NO_CHANGE, allowedActors: [...NO_CHANGE.allowedActors] },
    information: [{ field: 'email', isRequired: true }],
    requiredDocuments: [],
    instructions: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

interface BookingOptions {
  readonly id?: string;
  readonly service?: BookableService;
  readonly location?: BookingLocation;
  readonly start: number;
  readonly resources: readonly string[];
  readonly participants?: number;
  readonly status?: Booking['status'];
  readonly holdExpiresAt?: Date | null;
  readonly reference?: string;
}

const MINUTE = 60_000;
let referenceCounter = 0;

/** A booking as the engine sees it, with the occupied span derived from the service's buffers. */
export function makeBooking(options: BookingOptions): Booking {
  const service = options.service ?? makeService();
  const location = options.location ?? makeLocation();
  const id = options.id ?? `booking-${options.start}-${options.resources.join('+')}`;
  referenceCounter += 1;
  const reference = toBookingReference(
    options.reference ?? String(referenceCounter).padStart(10, '0'),
  );
  const end = options.start + service.durationMinutes * MINUTE;
  const shared = sharedSessionKey({
    serviceId: service.id,
    locationId: location.id,
    start: options.start,
    participantsPerSession: service.capacity.participantsPerSession,
  });
  const status = options.status ?? 'confirmed';
  return {
    id: toBookingId(id),
    tenantId: TENANT,
    websiteId: WEBSITE,
    serviceId: service.id,
    locationId: location.id,
    reference,
    status,
    start: new Date(options.start),
    end: new Date(end),
    occupiedStart: new Date(options.start - service.preparationMinutes * MINUTE),
    occupiedEnd: new Date(end + service.cleanupMinutes * MINUTE),
    participants: options.participants ?? 1,
    resourceIds: options.resources.map(toBookableResourceId),
    sessionKey: bookingSessionKey(shared, reference),
    sessionCapacity: service.capacity.participantsPerSession,
    customer: null,
    holdExpiresAt:
      options.holdExpiresAt ?? (status === 'held' ? new Date(NOW.getTime() + 10 * MINUTE) : null),
    rescheduleCount: 0,
    cancelledAt: null,
    cancelledBy: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

interface ScenarioOptions {
  readonly service?: BookableService;
  readonly location?: BookingLocation;
  readonly resources?: readonly BookableResource[];
  readonly bookings?: readonly Booking[];
  readonly now?: Date;
  readonly ignoreBookingId?: Booking['id'];
}

export function makeInput(options: ScenarioOptions = {}): SchedulingInput {
  return {
    service: options.service ?? makeService(),
    location: options.location ?? makeLocation(),
    resources: options.resources ?? [makeResource('emp-1')],
    bookings: options.bookings ?? [],
    now: options.now ?? NOW,
    ignoreBookingId: options.ignoreBookingId,
  };
}

export function indexFor(
  options: ScenarioOptions = {},
  days: LocalDateRange = range('2027-01-11', '2027-01-11'),
) {
  return buildSchedulingIndex(makeInput(options), days);
}

/** Wall-clock `HH:mm` of every slot in a zone, for readable assertions. */
export function times(
  slots: ReadonlyArray<{ readonly start: number }>,
  inZone: TimeZone = BERLIN,
): string[] {
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: inZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return slots.map((slot) => format.format(new Date(slot.start)));
}
