import { I18N_CONFIG } from '@i18n';
import type { Locale } from '@i18n';

import type { Clock } from '@lib/clock';
import { logger } from '@lib/logger';
import { PLATFORM_EMAIL_BRAND } from '@lib/mail';
import type { MailTransport } from '@lib/mail';
import { resolveMailLocale } from '@lib/mail/server';
import { ResultAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { renderBookingEmail } from './booking-email';

import type { WebsiteMailIdentity } from './website-mail-identity';
import type { WebsiteId } from '../../domain/models/ids';
import type { BookingNotice, BookingNotifier } from '../../domain/ports/booking-notifier.port';

const log = logger.withContext({ module: 'booking.mail' });

export interface EmailNotifierOptions {
  readonly clock: Clock;
  /** The website's slug and look; may throw, the message then goes out plain and without a link. */
  readonly readWebsite: (websiteId: WebsiteId) => Promise<WebsiteMailIdentity>;
  /** The address that opens "my booking" with this reference on the website, in that language. */
  readonly manageLink: (locale: Locale, slug: string, reference: string) => string;
}

/**
 * Sends the notice through the shared mail transport, in the language the visitor booked in (the
 * request's when the booking does not say) and in the look of the website. The booking is stored
 * before this runs, so a failed send is logged once, by its kind, and swallowed. Nothing personal
 * is logged: not the address, the name, the reference nor the message.
 */
export class EmailBookingNotifier implements BookingNotifier {
  constructor(
    private readonly transport: MailTransport,
    private readonly options: EmailNotifierOptions,
  ) {}

  notify(notice: BookingNotice): AppResultAsync<void, never> {
    return ResultAsync.fromSafePromise(
      Promise.all([this.localeOf(notice), this.websiteOf(notice.websiteId)]),
    )
      .andThen(([locale, website]) =>
        this.transport.send({
          to: notice.to,
          ...renderBookingEmail(notice, {
            locale,
            brand: website.brand,
            manageUrl:
              website.slug === null
                ? null
                : this.options.manageLink(locale, website.slug, notice.reference),
            now: this.options.clock.now(),
          }),
        }),
      )
      .orElse((error) => {
        log.error('booking.email_delivery_failed', { kind: notice.kind, err: error });
        return okAsync(undefined);
      });
  }

  private async localeOf({ locale }: BookingNotice): Promise<Locale> {
    const booked = I18N_CONFIG.locales.find((candidate) => candidate === locale);
    return booked ?? resolveMailLocale();
  }

  private websiteOf(websiteId: WebsiteId): Promise<WebsiteMailIdentity> {
    return this.options.readWebsite(websiteId).catch((error: unknown) => {
      log.warn('booking.mail_website_unreadable', { err: error });
      return { slug: null, brand: PLATFORM_EMAIL_BRAND };
    });
  }
}
