import { logger } from '@lib/logger';
import { PLATFORM_EMAIL_BRAND, createEmailBrand } from '@lib/mail';
import type { EmailBrand, MailTransport } from '@lib/mail';
import { resolveMailLocale } from '@lib/mail/server';
import { ResultAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { renderBookingEmail } from './booking-email-templates';

import type { WebsiteId } from '../../domain/models/ids';
import type { BookingNotice, BookingNotifier } from '../../domain/ports/booking-notifier.port';
import type { WebsiteBrandRepository } from '../../domain/ports/website-brand.repository';

const mailLogger = logger.withContext({ module: 'booking.mail' });

/**
 * Sends the notice through the shared mail transport, in the language of the
 * request and in the look of the website the booking was made on. The booking
 * is stored before this runs, so a failed send is reported once here and
 * swallowed: the result never carries an error. Only the error is logged,
 * never the message (it names the visitor).
 */
export class EmailBookingNotifier implements BookingNotifier {
  constructor(
    private readonly transport: MailTransport,
    private readonly brands: WebsiteBrandRepository,
  ) {}

  notify(notice: BookingNotice): AppResultAsync<void, never> {
    return ResultAsync.fromSafePromise(
      Promise.all([resolveMailLocale(), this.brandOf(notice.websiteId)]),
    )
      .andThen(([locale, brand]) =>
        this.transport.send({ to: notice.to, ...renderBookingEmail(notice, locale, brand) }),
      )
      .orElse((error) => {
        mailLogger.error('booking.email_delivery_failed', { kind: notice.kind, err: error });
        return okAsync(undefined);
      });
  }

  /** A website whose theme cannot be read gets the platform's look: a confirmation is never held back for its colours. */
  private brandOf(websiteId: WebsiteId): Promise<EmailBrand> {
    return this.brands.findPrimaryColorOf(websiteId).match(
      (color) => (color === null ? PLATFORM_EMAIL_BRAND : createEmailBrand(color)),
      (error) => {
        mailLogger.warn('booking.brand_unreadable', { err: error });
        return PLATFORM_EMAIL_BRAND;
      },
    );
  }
}
