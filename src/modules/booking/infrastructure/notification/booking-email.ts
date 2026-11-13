import type { Locale } from '@i18n';

import { renderEmail } from '@lib/mail';
import type { EmailBrand, MailAttachment, RenderedEmail } from '@lib/mail';
import { formatDate, isDefined } from '@lib/utils';

import { renderCalendarFile } from './booking-calendar-file';
import { BOOKING_EMAIL_COPY } from './booking-email-copy';

import type { BookingNotice } from '../../domain/ports/booking-notifier.port';

export interface BookingEmailOptions {
  readonly locale: Locale;
  readonly brand: EmailBrand;
  /** The booking on the website, to see or change it; `null` when the website is not known. */
  readonly manageUrl: string | null;
  readonly now: Date;
}

/** A subject is one line: whatever was typed into a service name cannot add a header or a break. */
const oneLine = (text: string) => text.replaceAll(/\s+/gu, ' ').trim();

/**
 * The message for one change to a booking, in the visitor's language and the website's look, with
 * the time on the location's clock (the place the visitor must be at). A message that confirms or
 * moves the appointment carries it as a calendar file; one that cancels it does not.
 */
export function renderBookingEmail(
  notice: BookingNotice,
  { locale, brand, manageUrl, now }: BookingEmailOptions,
): RenderedEmail & { readonly attachments: readonly MailAttachment[] } {
  const copy = BOOKING_EMAIL_COPY[locale];
  const { title, subject, intro, outro } = copy.notice[notice.kind];
  const date = (options: Intl.DateTimeFormatOptions) =>
    formatDate(notice.start, locale, notice.zone, options);
  const service = notice.serviceName ?? copy.appointment;
  const when = `${date({ dateStyle: 'full', timeStyle: 'short' })} (${copy.localTime.replace('{zone}', notice.zone)})`;
  const where = [notice.locationName, notice.locationAddress].filter(isDefined);
  const name = notice.recipientName?.trim() ?? '';
  const isLive = notice.kind !== 'cancelled';

  const rendered = renderEmail(
    {
      locale,
      title,
      subject: oneLine(
        subject.replace('{service}', service).replace('{date}', date({ dateStyle: 'medium' })),
      ),
      ...(name === '' ? {} : { greeting: copy.greeting.replace('{name}', name) }),
      intro: intro.replace('{service}', service),
      facts: [
        { label: copy.when, value: when },
        { label: copy.where, value: where.join(', ') },
        { label: copy.reference, value: notice.reference, style: 'code' },
      ],
      action:
        manageUrl !== null && isLive
          ? { label: copy.manage.label, url: manageUrl, note: copy.manage.note }
          : null,
      outro: isLive ? `${outro} ${copy.calendarAttached}` : outro,
    },
    brand,
  );
  const calendar = renderCalendarFile(
    {
      reference: notice.reference,
      start: notice.start,
      end: notice.end,
      sequence: notice.sequence,
      summary: oneLine(service),
      location: where.join(', '),
      description: `${copy.reference}: ${notice.reference}`,
      reminder: copy.calendar.reminder.replace('{service}', oneLine(service)),
      filename: copy.calendar.filename,
    },
    now,
  );
  return { ...rendered, attachments: isLive ? [calendar] : [] };
}
