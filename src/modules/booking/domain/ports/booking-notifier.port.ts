import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

export type BookingNoticeKind = 'confirmed' | 'cancelled' | 'rescheduled';

/**
 * What the person who booked is told after their booking changed. Plain
 * facts, no wording: the adapter owns copy and language (i18n.md). The time
 * is the wall clock AT THE LOCATION, with its zone named, because that is
 * what the visitor is expected to be on time for.
 */
export interface BookingNotice {
  readonly kind: BookingNoticeKind;
  /** The website the booking was made on, whose look the message takes. */
  readonly websiteId: WebsiteId;
  /** The address the visitor gave. Never log it. */
  readonly to: string;
  /** The first name the visitor gave, to greet them by; `null` when they gave none. Never log it. */
  readonly recipientName: string | null;
  readonly reference: string;
  readonly serviceName: string;
  readonly locationName: string;
  readonly locationAddress: string | null;
  /** When it starts and ends, as instants: what a calendar entry needs, whatever zone the reader is in. */
  readonly startsAt: Date;
  readonly endsAt: Date;
  /** How often the booking was moved: a calendar replaces an entry only for a higher number. */
  readonly sequence: number;
  /** `YYYY-MM-DD` at the location. */
  readonly localDate: string;
  /** `HH:mm` at the location. */
  readonly localTime: string;
  readonly timeZone: string;
  readonly participants: number;
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
}

/**
 * Tells a visitor about their booking by e-mail. A booking is already stored
 * when this runs, so a message that cannot be sent must never undo it:
 * adapters absorb delivery failures (and log them once) and the result never
 * carries an error.
 */
export interface BookingNotifier {
  notify(notice: BookingNotice): AppResultAsync<void, never>;
}
