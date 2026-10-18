import type { Locale } from '@i18n';

import type { Clock } from '@lib/clock';
import { logger } from '@lib/logger';
import { PLATFORM_EMAIL_BRAND, createEmailBrand } from '@lib/mail';
import type { EmailBrand, MailAttachment, MailTransport } from '@lib/mail';
import { resolveMailLocale } from '@lib/mail/server';
import { ResultAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { renderBookingCalendar, renderBookingEmail } from './booking-email-templates';

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
    private readonly options: {
      readonly clock: Clock;
      /** The address that opens the website's booking with this reference, in the person's language. */
      readonly manageLink: (locale: Locale, slug: string, reference: string) => string;
    },
  ) {}

  notify(notice: BookingNotice): AppResultAsync<void, never> {
    return ResultAsync.fromSafePromise(
      Promise.all([
        resolveMailLocale(),
        this.brandOf(notice.websiteId),
        this.slugOf(notice.websiteId),
      ]),
    )
      .andThen(([locale, brand, slug]) =>
        this.transport.send({
          to: notice.to,
          ...renderBookingEmail(notice, {
            locale,
            brand,
            manageUrl:
              slug === null ? null : this.options.manageLink(locale, slug, notice.reference),
          }),
          attachments: this.calendarOf(notice, locale),
        }),
      )
      .orElse((error) => {
        mailLogger.error('booking.email_delivery_failed', { kind: notice.kind, err: error });
        return okAsync(undefined);
      });
  }

  private calendarOf(notice: BookingNotice, locale: Locale): readonly MailAttachment[] {
    const file = renderBookingCalendar(notice, locale, this.options.clock.now());
    return file === null ? [] : [file];
  }

  /** Where the website lives; without it the message simply has no link to it. */
  private slugOf(websiteId: WebsiteId): Promise<string | null> {
    return this.brands.findSlugOf(websiteId).match(
      (slug) => slug,
      (error) => {
        mailLogger.warn('booking.slug_unreadable', { err: error });
        return null;
      },
    );
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
