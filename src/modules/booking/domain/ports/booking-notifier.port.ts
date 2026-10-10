import type { AppResultAsync } from '@lib/result';

export type BookingNoticeKind = 'confirmed' | 'cancelled' | 'rescheduled';

/**
 * What the person who booked is told after their booking changed. Plain
 * facts, no wording: the adapter owns copy and language (i18n.md). The time
 * is the wall clock AT THE LOCATION, with its zone named, because that is
 * what the visitor is expected to be on time for.
 */
export interface BookingNotice {
  readonly kind: BookingNoticeKind;
  /** The address the visitor gave. Never log it. */
  readonly to: string;
  readonly reference: string;
  readonly serviceName: string;
  readonly locationName: string;
  readonly locationAddress: string | null;
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
