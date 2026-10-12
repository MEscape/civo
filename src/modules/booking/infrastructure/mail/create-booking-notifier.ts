import { getMailTransport } from '@lib/mail/server';

import { EmailBookingNotifier } from './email-booking-notifier';
import { SkippedBookingNotifier } from './skipped-booking-notifier';

import type { BookingNotifier } from '../../domain/ports/booking-notifier.port';
import type { WebsiteBrandRepository } from '../../domain/ports/website-brand.repository';

/** The notifier the mail settings call for: real mail, or a logged skip when none is configured. */
export function createBookingNotifier(brands: WebsiteBrandRepository): BookingNotifier {
  const transport = getMailTransport();
  return transport === null
    ? new SkippedBookingNotifier()
    : new EmailBookingNotifier(transport, brands);
}
