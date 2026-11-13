/** What the employee's own area sends: untrusted text and numbers until the use case parsed them. */

/** Before or after midday on the location's clock. */
export const PARTS_OF_DAY = ['morning', 'afternoon'] as const;
export type PartOfDay = (typeof PARTS_OF_DAY)[number];

/** One day of the plan, `YYYY-MM-DD`; absent: today. */
export interface GetDayPlanInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly date?: string | undefined;
}

/** Narrows the open bookings; every field absent: all of them. */
export interface GetOpenBookingsInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  /** `YYYY-MM-DD` on the booking's location's calendar. */
  readonly date?: string | undefined;
  readonly locationId?: string | undefined;
  readonly partOfDay?: PartOfDay | undefined;
}

export interface SavePreferencesInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly serviceIds: readonly string[];
  readonly window: { readonly startMinute: number; readonly endMinute: number } | null;
}

export interface ListMessagesInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly page?: number | undefined;
}

/** One message, or (`null`) every unread one. */
export interface MarkMessagesReadInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly messageId: string | null;
}

export { MAX_PREFERRED_SERVICES } from '../booking-limits';
