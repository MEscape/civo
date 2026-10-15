import type { TenantId } from '@modules/auth';

import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { ok, err } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  addFieldErrors,
  createBookingErrorBag,
} from '../errors/booking-errors';
import { clipToFrame } from '../scheduling/hours-containment';
import { parseTimeZone } from '../time/time-zone';

import { createAvailabilityPlan } from './availability-plan';
import { blankToNull } from './text';

import type { AvailabilityPlan, AvailabilityPlanInput } from './availability-plan';
import type { BookingLocationId, WebsiteId } from './ids';
import type { TimeZone } from '../time/time-zone';

export const LOCATION_LIMITS = {
  nameMax: 120,
  addressMax: 300,
} as const;

/**
 * Where a booking takes place: a town hall, a sports ground, or a virtual
 * place (no address). The location's time zone is the one every wall-clock
 * statement about it is read in, and its opening hours bound everything
 * that happens there: no resource is bookable while the location is closed.
 */
export interface BookingLocation {
  readonly id: BookingLocationId;
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
  readonly name: string;
  /** `null` for a virtual location. */
  readonly address: string | null;
  readonly timeZone: TimeZone;
  readonly openingHours: AvailabilityPlan;
  /**
   * The week in which employees may work here, inside the opening hours, or
   * `null` when they may work whenever it is open. A manager narrows it; an
   * employee's own hours stay inside it.
   */
  readonly staffHours: AvailabilityPlan | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface BookingLocationInput {
  readonly websiteId: WebsiteId;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
  readonly openingHours: AvailabilityPlanInput;
  /** `null`: employees may work whenever the location is open. */
  readonly staffHours?: AvailabilityPlanInput | null | undefined;
  readonly isActive: boolean;
}

/** What is stored when a location is created or replaced; the store adds identity and timestamps. */
export type BookingLocationDraft = Omit<
  BookingLocation,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt'
>;

function parseStaffHours(
  raw: BookingLocationInput['staffHours'],
  bag: FieldErrorBag,
): AvailabilityPlan | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const staff = createAvailabilityPlan(raw, 'staffHours');
  if (staff.isErr()) {
    addFieldErrors(bag, staff.error);
    return null;
  }
  return staff.value;
}

/**
 * The week employees may work at a location: the hours set for them, cut to
 * the opening hours (narrowing the opening hours narrows this too, so the two
 * can never disagree), or the opening hours themselves when none are set.
 */
export function employeeHoursOf(
  location: Pick<BookingLocation, 'openingHours' | 'staffHours'>,
): AvailabilityPlan {
  return location.staffHours === null
    ? location.openingHours
    : clipToFrame(location.staffHours, location.openingHours);
}

export function createBookingLocationDraft(
  input: BookingLocationInput,
): AppResult<BookingLocationDraft, ValidationAppError> {
  const bag = createBookingErrorBag();

  const name = input.name.trim();
  if (name === '') {
    bag.add('name', CODES.nameRequired);
  } else if (name.length > LOCATION_LIMITS.nameMax) {
    bag.add('name', CODES.textTooLong);
  }

  const address = blankToNull(input.address);
  if (address !== null && address.length > LOCATION_LIMITS.addressMax) {
    bag.add('address', CODES.textTooLong);
  }

  const timeZone = parseTimeZone(input.timeZone.trim());
  if (timeZone === null) {
    bag.add('timeZone', CODES.timeZoneInvalid);
  }

  const hours = createAvailabilityPlan(input.openingHours, 'openingHours');
  if (hours.isErr()) {
    addFieldErrors(bag, hours.error);
  }

  const staff = parseStaffHours(input.staffHours, bag);

  if (bag.hasErrors || timeZone === null || hours.isErr()) {
    return err(bag.toError());
  }

  return ok({
    websiteId: input.websiteId,
    name,
    address,
    timeZone,
    openingHours: hours.value,
    staffHours: staff,
    isActive: input.isActive,
  });
}
