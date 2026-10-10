import { logger } from '@lib/logger';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import type { BookingNotice, BookingNotifier } from '../../domain/ports/booking-notifier.port';

const mailLogger = logger.withContext({ module: 'booking.mail' });

/**
 * Used while `MAIL_PROVIDER=none` (local development): the booking works and
 * the missing message is visible in the log instead of silently absent.
 * Production refuses to start without a mail provider.
 */
export class SkippedBookingNotifier implements BookingNotifier {
  notify(notice: BookingNotice): AppResultAsync<void, never> {
    mailLogger.warn('booking.email_skipped', { kind: notice.kind, reason: 'MAIL_PROVIDER=none' });
    return okAsync(undefined);
  }
}
