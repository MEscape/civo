import { logger } from '@lib/logger';
import type { MailTransport } from '@lib/mail';
import { resolveMailLocale } from '@lib/mail/server';
import { ResultAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { renderBookingEmail } from './booking-email-templates';

import type { BookingNotice, BookingNotifier } from '../../domain/ports/booking-notifier.port';

const mailLogger = logger.withContext({ module: 'booking.mail' });

/**
 * Sends the notice through the shared mail transport, in the language of the
 * request. The booking is stored before this runs, so a failed send is
 * reported once here and swallowed: the result never carries an error. Only
 * the error is logged, never the message (it names the visitor).
 */
export class EmailBookingNotifier implements BookingNotifier {
  constructor(private readonly transport: MailTransport) {}

  notify(notice: BookingNotice): AppResultAsync<void, never> {
    return ResultAsync.fromSafePromise(resolveMailLocale())
      .andThen((locale) =>
        this.transport.send({ to: notice.to, ...renderBookingEmail(notice, locale) }),
      )
      .orElse((error) => {
        mailLogger.error('booking.email_delivery_failed', { kind: notice.kind, err: error });
        return okAsync(undefined);
      });
  }
}
