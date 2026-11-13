import { logger } from '@lib/logger';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import type { BookingNotice, BookingNotifier } from '../../domain/ports/booking-notifier.port';

const log = logger.withContext({ module: 'booking.notification' });

/**
 * The notifier wired while `MAIL_PROVIDER=none`: it sends nothing and says so.
 * It logs that a notice was skipped, with the kind and the website only, never the address, the
 * name or the reference, so the log holds no personal data. It cannot fail.
 */
export class SkippedBookingNotifier implements BookingNotifier {
  notify({ kind, websiteId }: BookingNotice): AppResultAsync<void, never> {
    log.info('booking.notice_skipped', { kind, websiteId });
    return okAsync(undefined);
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const skippedBookingNotifier = new SkippedBookingNotifier();
