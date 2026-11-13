import { isBlank } from '@lib/utils';

import { settingAt } from '../models/service-at-location';

import type { BookableService, InformationField } from '../models/bookable-service';
import type { BookingCustomer } from '../models/booking';
import type { BookingLocationId } from '../models/ids';

/** Who is booking: a visitor online, or a manager for somebody. */
export type BookingChannel = 'online' | 'staff';

/** Why a service cannot be booked at a location, or `null` when it can. */
export type BookableDenial = 'service-inactive' | 'location-not-offered';

/**
 * A service is booked only while it is switched on, here and as a whole, and only at the locations
 * that offer it. A service that takes no online bookings at a location is not offered there to a
 * visitor, but a manager may still book it (BD-19).
 */
export function evaluateBookable(
  service: BookableService,
  locationId: BookingLocationId,
  channel: BookingChannel,
): BookableDenial | null {
  if (!service.isActive) {
    return 'service-inactive';
  }
  const setting = settingAt(service, locationId);
  if (setting === null || (channel === 'online' && !setting.isOnlineBookable)) {
    return 'location-not-offered';
  }
  return setting.isActive ? null : 'service-inactive';
}

/** The required fields the customer left blank, in the order the service lists them. */
export function missingInformation(
  service: BookableService,
  customer: BookingCustomer,
): InformationField[] {
  return service.information
    .filter((requirement) => requirement.isRequired && isBlank(customer[requirement.field]))
    .map((requirement) => requirement.field);
}

/**
 * Whether an employee may take an open booking of this service by themselves (BD-07, proposed):
 * only a service whose bookings are claimed. A manager assigns the others, and an `automatic` one
 * has its employees from the start.
 */
export function mayEmployeeClaim(service: BookableService): boolean {
  return service.assignmentMode === 'open';
}

/**
 * Whether a booking may be made with employee requirements still unassigned (BD-07, proposed):
 * only a service that is assigned by a manager or claimed by an employee. A room or a desk is
 * always held.
 */
export function mayLeaveEmployeesUnassigned(service: BookableService): boolean {
  return service.assignmentMode !== 'automatic';
}
