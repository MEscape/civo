import type { AppResultAsync } from '@lib/result';

import type { BookingAccessError } from './booking-access.port';
import type { WebsiteId } from '../models/ids';

/** A website the signed-in person works in through bookings, as a manager or as an employee. */
export interface BookingWorkspace {
  readonly id: WebsiteId;
  readonly name: string;
  /** Whether they may open the website itself too; an employee's only way in is the bookings. */
  readonly canOpenWebsite: boolean;
}

export interface BookingWorkspaces {
  /** By name. */
  readonly websites: readonly BookingWorkspace[];
  /** Whether there is any website at all that they may open, bookings or not. */
  readonly hasOpenableWebsite: boolean;
  readonly isTruncated: boolean;
}

/**
 * Which websites the signed-in person works in through bookings. Auth owns who may do what where, so
 * this is only a question to it; nothing is granted by the answer, every destination authorizes again.
 */
export interface BookingWorkspaceDirectory {
  list(): AppResultAsync<BookingWorkspaces, BookingAccessError>;
}
