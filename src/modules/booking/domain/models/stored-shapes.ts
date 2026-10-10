import {
  arrayOf,
  isBoolean,
  isFiniteNumber,
  isString,
  nullable,
  objectOf,
  oneOf,
  optional,
} from '@lib/utils';
import type { Guard } from '@lib/utils';

import { CHANGE_ACTORS } from './bookable-service';

import type {
  AvailabilityExceptionInput,
  AvailabilityPlanInput,
  DayScheduleInput,
  TimeRangeInput,
} from './availability-plan';
import type { ChangeActor, ChangePolicyInput, ResourceRequirementInput } from './bookable-service';
import type { BookingCustomer } from './booking-customer';

/**
 * The JSON columns, as they are read back. Stored JSON is untrusted data like
 * any other input: it was valid when written, but a hand-edited row or an
 * older shape must fail loudly rather than reach the scheduling engine. These
 * guards check only the SHAPE; the domain constructors that run next check the
 * rules (ranges that overlap, unknown time zones, and so on), so the rules
 * live in one place. Each guard covers the JSON columns of one table and
 * accepts the whole row.
 */

const isTimeRange = objectOf<TimeRangeInput>({ start: isString, end: isString });

const isDaySchedule = objectOf<DayScheduleInput>({
  intervals: arrayOf(isTimeRange),
  breaks: arrayOf(isTimeRange),
});

const isException = objectOf<AvailabilityExceptionInput>({
  kind: isString,
  from: isString,
  to: isString,
  day: optional(isDaySchedule),
  label: optional(nullable(isString)),
});

const isAvailabilityPlan = objectOf<AvailabilityPlanInput>({
  weekly: arrayOf(isDaySchedule),
  exceptions: arrayOf(isException),
});

const isStringList = arrayOf(isString);

const isChangePolicy = objectOf<ChangePolicyInput>({
  isAllowed: isBoolean,
  deadlineMinutes: isFiniteNumber,
  allowedActors: isStringList,
});

const isRequirement = objectOf<ResourceRequirementInput>({
  resourceType: isString,
  skills: isStringList,
  count: isFiniteNumber,
  resourceIds: nullable(isStringList),
});

interface StoredInformation {
  readonly field: string;
  readonly isRequired: boolean;
}

const isInformation = objectOf<StoredInformation>({ field: isString, isRequired: isBoolean });

export interface StoredLocation {
  readonly openingHours: AvailabilityPlanInput;
}

export interface StoredResource {
  readonly skills: string[];
  readonly availability: AvailabilityPlanInput | null;
}

export interface StoredService {
  readonly locationIds: string[];
  readonly requirements: ResourceRequirementInput[];
  readonly availability: AvailabilityPlanInput | null;
  readonly cancellation: ChangePolicyInput;
  readonly rescheduling: ChangePolicyInput;
  readonly information: StoredInformation[];
  readonly requiredDocuments: string[];
}

export interface StoredBooking {
  readonly customer: BookingCustomer | null;
  readonly cancelledBy: ChangeActor | null;
}

const isCustomer = objectOf<BookingCustomer>({
  firstName: nullable(isString),
  lastName: nullable(isString),
  email: isString,
  phone: nullable(isString),
  referenceNumber: nullable(isString),
  notes: nullable(isString),
});

const isStoredLocation: Guard<StoredLocation> = objectOf<StoredLocation>({
  openingHours: isAvailabilityPlan,
});

const isStoredResource: Guard<StoredResource> = objectOf<StoredResource>({
  skills: isStringList,
  availability: nullable(isAvailabilityPlan),
});

const isStoredService: Guard<StoredService> = objectOf<StoredService>({
  locationIds: isStringList,
  requirements: arrayOf(isRequirement),
  availability: nullable(isAvailabilityPlan),
  cancellation: isChangePolicy,
  rescheduling: isChangePolicy,
  information: arrayOf(isInformation),
  requiredDocuments: isStringList,
});

const isStoredBooking: Guard<StoredBooking> = objectOf<StoredBooking>({
  customer: nullable(isCustomer),
  cancelledBy: nullable(oneOf(CHANGE_ACTORS)),
});

/** The typed JSON members of a stored row, or `null` when its shape is not what this build writes. */
export function readStoredLocation(row: unknown): StoredLocation | null {
  return isStoredLocation(row) ? row : null;
}

export function readStoredResource(row: unknown): StoredResource | null {
  return isStoredResource(row) ? row : null;
}

export function readStoredService(row: unknown): StoredService | null {
  return isStoredService(row) ? row : null;
}

export function readStoredBooking(row: unknown): StoredBooking | null {
  return isStoredBooking(row) ? row : null;
}
