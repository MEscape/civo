import type { Locale } from '@i18n';

import type { BookingNoticeKind } from '../../domain/ports/booking-notifier.port';

interface NoticeCopy {
  readonly title: string;
  /** What the inbox lists; `{service}` and `{date}` say which appointment at a glance. */
  readonly subject: string;
  readonly intro: string;
  readonly outro: string;
}

export interface BookingEmailCopy {
  /** `{name}` is the first name the visitor gave. */
  readonly greeting: string;
  /** Stands in for the service of a booking made before its name was kept. */
  readonly appointment: string;
  readonly manage: { readonly label: string; readonly note: string };
  readonly calendarAttached: string;
  readonly when: string;
  readonly where: string;
  readonly reference: string;
  /** `{zone}` is the location's time zone. */
  readonly localTime: string;
  readonly calendar: { readonly filename: string; readonly reminder: string };
  readonly notice: Readonly<Record<BookingNoticeKind, NoticeCopy>>;
}

const KEEP_THIS =
  'Zum Ändern oder Absagen brauchen Sie die Buchungsnummer und diese E-Mail-Adresse. Bitte heben Sie diese Nachricht auf.';
const KEEP_THIS_EN =
  'To change or cancel it you need the booking number and this e-mail address. Please keep this message.';

/**
 * The wording of booking messages. It lives with the adapter, not in the app's catalogs: a message
 * is written on the server in the language the visitor booked in, outside any page. A
 * `Record<Locale, …>`, so a new language does not compile until it has words here.
 */
export const BOOKING_EMAIL_COPY: Readonly<Record<Locale, BookingEmailCopy>> = {
  de: {
    greeting: 'Hallo {name},',
    appointment: 'Ihr Termin',
    manage: {
      label: 'Termin ansehen oder ändern',
      note: 'Ihre Buchungsnummer ist dort schon eingetragen; zur Bestätigung geben Sie Ihre E-Mail-Adresse ein.',
    },
    calendarAttached: 'Den Termin finden Sie auch als Kalenderdatei im Anhang.',
    when: 'Wann',
    where: 'Wo',
    reference: 'Buchungsnummer',
    localTime: 'Ortszeit ({zone})',
    calendar: { filename: 'termin.ics', reminder: 'In einer Stunde: {service}' },
    notice: {
      confirmed: {
        title: 'Ihr Termin ist gebucht',
        subject: 'Termin gebucht: {service}, {date}',
        intro: 'Ihr Termin „{service}“ ist gebucht.',
        outro: KEEP_THIS,
      },
      cancelled: {
        title: 'Ihr Termin wurde abgesagt',
        subject: 'Termin abgesagt: {service}, {date}',
        intro: 'Ihr Termin „{service}“ wurde abgesagt.',
        outro: 'Sie können jederzeit einen neuen Termin buchen.',
      },
      rescheduled: {
        title: 'Ihr Termin wurde verschoben',
        subject: 'Termin verschoben: {service}, {date}',
        intro: 'Ihr Termin „{service}“ hat eine neue Zeit.',
        outro: KEEP_THIS,
      },
    },
  },
  en: {
    greeting: 'Hello {name},',
    appointment: 'Your appointment',
    manage: {
      label: 'View or change the appointment',
      note: 'Your booking number is already filled in there; confirm with your e-mail address.',
    },
    calendarAttached: 'The appointment is also attached as a calendar file.',
    when: 'When',
    where: 'Where',
    reference: 'Booking number',
    localTime: 'local time ({zone})',
    calendar: { filename: 'appointment.ics', reminder: 'In one hour: {service}' },
    notice: {
      confirmed: {
        title: 'Your appointment is booked',
        subject: 'Appointment booked: {service}, {date}',
        intro: 'Your appointment “{service}” is booked.',
        outro: KEEP_THIS_EN,
      },
      cancelled: {
        title: 'Your appointment was cancelled',
        subject: 'Appointment cancelled: {service}, {date}',
        intro: 'Your appointment “{service}” was cancelled.',
        outro: 'You can book a new appointment at any time.',
      },
      rescheduled: {
        title: 'Your appointment was moved',
        subject: 'Appointment moved: {service}, {date}',
        intro: 'Your appointment “{service}” has a new time.',
        outro: KEEP_THIS_EN,
      },
    },
  },
};
