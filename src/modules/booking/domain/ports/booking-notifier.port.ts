import type { AppResultAsync } from '@lib/result';

import type { BookingReference } from '../models/booking-reference';
import type { BookableServiceId, BookingLocationId, WebsiteId } from '../models/ids';
import type { Instant } from '../time/instant';
import type { TimeZone } from '../time/time-zone';

export type BookingNoticeKind = 'confirmed' | 'cancelled' | 'rescheduled';

/**
 * What the person who booked is told after their booking changed. Plain facts, no wording: the
 * adapter owns copy and language (i18n.md). The instants are absolute; `zone` is the location's, in
 * which the visitor is expected to be on time.
 */
export interface BookingNotice {
  readonly kind: BookingNoticeKind;
  readonly websiteId: WebsiteId;
  /** The address the visitor gave. Never log it. */
  readonly to: string;
  /** The first name the visitor gave, to greet them by. Never log it. */
  readonly recipientName: string | null;
  readonly reference: BookingReference;
  readonly serviceId: BookableServiceId;
  readonly locationId: BookingLocationId;
  /** The service as it was booked (the snapshot's name; `null` for a booking made before it was kept), and the place. */
  readonly serviceName: string | null;
  readonly locationName: string;
  readonly locationAddress: string | null;
  /** The language the visitor booked in; `null`: unknown, the adapter picks. */
  readonly locale: string | null;
  readonly start: Instant;
  readonly end: Instant;
  readonly zone: TimeZone;
  /** How often the booking was moved: a calendar replaces an entry only for a higher number. */
  readonly sequence: number;
}

/**
 * Tells a visitor about their booking. A booking is already stored when this runs, so a message
 * that cannot be sent must never undo it: adapters absorb delivery failures (and log them once) and
 * the result never carries an error. Use cases call it only after the write has committed, and never
 * wait on it for their own answer to fail.
 *
 * Shortcut: the mails are not queued, so a message is lost when the process stops between the
 * commit and the call. A transactional outbox is the upgrade when delivery must be guaranteed.
 */
export interface BookingNotifier {
  notify(notice: BookingNotice): AppResultAsync<void, never>;
}
