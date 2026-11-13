import { MS_PER_SECOND } from '@lib/utils';

import { toBookingReference } from '../../domain/models/booking-reference';

import type { WebsiteId } from '../../domain/models/ids';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingNoticeKind } from '../../domain/ports/booking-notifier.port';
import type { StoredBooking } from '../../domain/ports/booking.repository';
import type { BookingDependencies, BookingFlowDependencies } from '../booking-dependencies';

type Notifying = Pick<BookingDependencies | BookingFlowDependencies, 'notifier'>;

/**
 * Tells the person who booked about a change that has ALREADY been committed. Called after the
 * write returned, never before and never inside it, so a message can never describe something that
 * did not happen; and it never fails the use case: the notifier absorbs its own delivery failures.
 * A booking without an address (a hold) has nobody to tell.
 */
export function announce(
  deps: Notifying,
  notice: {
    readonly kind: BookingNoticeKind;
    readonly stored: StoredBooking;
    readonly location: BookingLocationFacts;
    readonly websiteId: WebsiteId;
  },
): void {
  const { kind, location, websiteId } = notice;
  const { booking, placement } = notice.stored;
  const to = booking.customer?.email;
  if (to === undefined) {
    return;
  }
  void deps.notifier
    .notify({
      kind,
      websiteId,
      to,
      recipientName: booking.customer?.firstName ?? null,
      reference: toBookingReference(placement.reference),
      serviceId: booking.serviceId,
      locationId: booking.locationId,
      serviceName: placement.snapshot?.serviceName ?? null,
      locationName: location.name,
      locationAddress: location.address,
      locale: placement.locale ?? null,
      start: booking.start,
      end: booking.end,
      zone: location.zone,
      // Seconds since the booking was made: grows with every change, whoever made it.
      sequence: Math.floor((booking.updatedAt - booking.createdAt) / MS_PER_SECOND),
    })
    .match(
      () => undefined,
      () => undefined,
    );
}
