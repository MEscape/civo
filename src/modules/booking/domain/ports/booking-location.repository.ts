import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingScope } from './booking.repository';
import type { BookingLocationId } from '../models/ids';
import type { AvailabilityPlan } from '../scheduling/availability-plan';
import type { TimeZone } from '../time/time-zone';

/** A location as the booking rules use it: where it is on the clock, whether it takes bookings, and what a visitor is told of it. */
export interface BookingLocationFacts {
  readonly id: BookingLocationId;
  /** What visitors are told the place is called, and where it is. */
  readonly name: string;
  readonly address: string | null;
  readonly zone: TimeZone;
  readonly isActive: boolean;
  /** When the location is open for appointments. */
  readonly openingHours: AvailabilityPlan;
}

/**
 * Read-only access to the locations of a website. Its opening hours are read in the shape the first version
 * stored (`availability-record-mapper.ts`); the administration (P06) may change it. Answers `null` for a location of another
 * website.
 */
export interface BookingLocationRepository {
  findById(
    scope: BookingScope,
    id: BookingLocationId,
  ): AppResultAsync<BookingLocationFacts | null, InfrastructureAppError>;
}
