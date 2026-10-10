import type { BookingStatus } from '../../domain/models/booking';

/** The visitor's reservation and booking. Plain and serializable apart from `Date`, which presentation turns into ISO strings. */

/** A reserved slot waiting for the visitor's details. `holdId` is the capability to continue; keep it out of URLs that are shared. */
export interface HoldView {
  readonly holdId: string;
  readonly expiresAt: Date;
  readonly start: Date;
  readonly end: Date;
  readonly participants: number;
  readonly timeZone: string;
  readonly serviceName: string;
  readonly locationName: string;
}

/** The visitor's own booking, as shown on the confirmation and the "my booking" page. */
export interface BookingView {
  readonly reference: string;
  readonly status: BookingStatus;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly locationAddress: string | null;
  readonly timeZone: string;
  readonly start: Date;
  readonly end: Date;
  readonly participants: number;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string | null;
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
  readonly canCancel: boolean;
  readonly canReschedule: boolean;
  readonly rescheduleCount: number;
}
