import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import type {
  BookableService,
  ChangePolicy,
} from '@modules/booking/domain/models/bookable-service';
import type { Assignment, Booking } from '@modules/booking/domain/models/booking';
import {
  toBookableResourceId,
  toBookableServiceId,
  toBookingId,
  toBookingLocationId,
} from '@modules/booking/domain/models/ids';
import { prepareScheduling } from '@modules/booking/domain/scheduling/prepare-scheduling';
import type {
  PlannedSlot,
  ResourceSchedule,
  Scheduling,
} from '@modules/booking/domain/scheduling/scheduling-types';
import { appointmentAt, occupiedSpanOf } from '@modules/booking/domain/scheduling/slot-rules';
import type { SlotRulesInput } from '@modules/booking/domain/scheduling/slot-rules';
import { createStartWindow } from '@modules/booking/domain/scheduling/start-window';
import type { Instant } from '@modules/booking/domain/time/instant';
import { createLocalDateRange } from '@modules/booking/domain/time/local-date-range';
import { parseMinutes } from '@modules/booking/domain/time/minutes';
import type { TimeInterval } from '@modules/booking/domain/time/time-interval';

import { BERLIN, at, between, day, rulesOf, unwrap } from './time-fixtures';

/** Opening hours in the stored shape: Monday to Friday 08:00-17:00 with a break at noon, closed on the weekend. */
export const STORED_WORKING_WEEK = {
  weekly: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    intervals: weekday <= 5 ? [{ start: '08:00', end: '17:00' }] : [],
    breaks: weekday <= 5 ? [{ start: '12:00', end: '13:00' }] : [],
  })),
  exceptions: [],
};

export const MONDAY = '2027-01-11';
/** The evening before: a customer has plenty of notice for a Monday booking. */
export const NOW = at('2027-01-10', '12:00');

export const LOCATION = toBookingLocationId('loc-west');
export const OTHER_LOCATION = toBookingLocationId('loc-mitte');
export const SERVICE_ID = toBookableServiceId('svc-passport');
export const BOOKING_ID = toBookingId('booking-1');

export function minutes(value: number) {
  const parsed = parseMinutes(value);
  if (parsed === null) {
    throw new Error(`fixture: ${value} is not minutes`);
  }
  return parsed;
}

export function allowedPolicy(
  deadlineMinutes: number,
  overrides: Partial<ChangePolicy> = {},
): ChangePolicy {
  return {
    isAllowed: true,
    deadlineMinutes: minutes(deadlineMinutes),
    allowedActors: ['customer', 'employee', 'manager'],
    ...overrides,
  };
}

/** A passport service: 30 minutes on a 30-minute grid, needing one qualified employee. */
export function makeService(
  overrides: Partial<BookableService> & { readonly slot?: Partial<SlotRulesInput> } = {},
): BookableService {
  const { slot, ...rest } = overrides;
  return {
    id: SERVICE_ID,
    name: 'Reisepass beantragen',
    isActive: true,
    rules: rulesOf(slot),
    noticeMinutes: minutes(0),
    horizonDays: 30,
    locations: [{ locationId: LOCATION, isActive: true, isOnlineBookable: true, resources: [] }],
    requirements: [{ resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: null }],
    cancellation: allowedPolicy(24 * 60),
    rescheduling: allowedPolicy(12 * 60),
    information: [
      { field: 'firstName', isRequired: true },
      { field: 'email', isRequired: true },
      { field: 'phone', isRequired: false },
    ],
    assignmentMode: 'automatic',
    availability: null,
    ...rest,
  };
}

export function employee(id: string, overrides: Partial<BookableResource> = {}): BookableResource {
  return {
    id: toBookableResourceId(id),
    name: id,
    capacity: null,
    type: 'employee',
    skills: ['ausweise'],
    locationId: LOCATION,
    isActive: true,
    setupMinutes: minutes(0),
    teardownMinutes: minutes(0),
    availability: null,
    coverage: [],
    ...overrides,
  };
}

/** What an employee is held for on the default booking: Monday 10:00-10:30 with the default buffers. */
const DEFAULT_UNIT_SPAN = occupiedSpanOf(appointmentAt(at(MONDAY, '10:00'), rulesOf()), rulesOf());

export function unitOf(id: string | null, overrides: Partial<Assignment> = {}): Assignment {
  return {
    requirementIndex: 0,
    resourceType: 'employee',
    resourceId: id === null ? null : toBookableResourceId(id),
    occupied: DEFAULT_UNIT_SPAN,
    ...overrides,
  };
}

/** A confirmed booking on Monday 10:00-10:30 with Anna assigned, unless the overrides say otherwise. */
export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  const start = at(MONDAY, '10:00');
  const rules = rulesOf();
  const appointment = appointmentAt(start, rules);
  return {
    id: BOOKING_ID,
    serviceId: SERVICE_ID,
    locationId: LOCATION,
    status: 'confirmed',
    start,
    end: appointment.end,
    occupied: occupiedSpanOf(appointment, rules),
    assignments: [unitOf('anna', { occupied: overrides.occupied ?? DEFAULT_UNIT_SPAN })],
    customer: { firstName: 'Julia', email: 'julia@example.org' },
    holdExpiresAt: null,
    rescheduleCount: 0,
    cancelledAt: null,
    cancelledBy: null,
    createdAt: at('2027-01-05', '09:00'),
    updatedAt: at('2027-01-05', '09:00'),
    ...overrides,
  };
}

/** A slot as the engine would plan it for `service` at `time` on Monday, with the given resources per requirement. */
export function slotAt(
  service: BookableService,
  time: string,
  requirementResourceIds: ReadonlyArray<readonly string[]> = [['anna']],
  date: string = MONDAY,
): PlannedSlot {
  const appointment = appointmentAt(at(date, time), service.rules);
  return {
    start: appointment.start,
    end: appointment.end,
    occupied: occupiedSpanOf(appointment, service.rules),
    resourceSpans: Object.fromEntries(
      requirementResourceIds.flat().map((id) => [id, occupiedSpanOf(appointment, service.rules)]),
    ),
    resourceIds: [...requirementResourceIds.flat()].sort(),
    requirementResourceIds,
  };
}

export function schedule(
  id: string,
  availability: readonly TimeInterval[],
  busy: readonly TimeInterval[] = [],
): ResourceSchedule {
  return { id, availability, busy };
}

export const WORKDAY = between(MONDAY, '08:00', '17:00');

/** The scheduling question for Monday, one requirement with the given employees. */
export function schedulingFor(
  service: BookableService,
  employees: readonly ResourceSchedule[],
  options: { now?: Instant; open?: readonly TimeInterval[] } = {},
): Scheduling {
  const range = createLocalDateRange(day(MONDAY), day(MONDAY), 62);
  if (range === null) {
    throw new Error('fixture: range');
  }
  const now = options.now ?? NOW;
  return unwrap(
    prepareScheduling({
      zone: BERLIN,
      range,
      rules: service.rules,
      startWindow: unwrap(
        createStartWindow({
          now,
          zone: BERLIN,
          noticeMinutes: service.noticeMinutes,
          horizonDays: service.horizonDays,
        }),
      ),
      openWindows: options.open ?? [WORKDAY],
      requirements: [{ count: 1, resources: employees }],
    }),
  );
}
