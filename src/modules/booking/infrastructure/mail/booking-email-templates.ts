import type { Locale } from '@i18n';

import { renderEmail } from '@lib/mail';
import type { EmailBrand, RenderedEmail } from '@lib/mail';

import { renderBookingCalendarFile } from './booking-calendar-file';

import type { CalendarCopy, CalendarFile } from './booking-calendar-file';
import type { BookingNotice, BookingNoticeKind } from '../../domain/ports/booking-notifier.port';

interface NoticeCopy {
  /** The heading. */
  readonly title: string;
  /** What the inbox lists; `{service}` and `{date}` say which appointment at a glance. */
  readonly subject: string;
  readonly intro: string;
  readonly outro: string;
}

interface SharedCopy {
  readonly when: string;
  readonly where: string;
  readonly reference: string;
  readonly participants: string;
  readonly documents: string;
  readonly instructions: string;
  readonly zoneNote: string;
}

interface LocaleCopy {
  /** `{name}` is the first name the visitor gave. */
  readonly greeting: string;
  /** The button to the booking, and what to do there. */
  readonly manage: { readonly label: string; readonly note: string };
  /** Appended to the closing words of a message that carries a calendar file. */
  readonly calendarAttached: string;
  readonly calendar: CalendarCopy;
  readonly notice: Readonly<Record<BookingNoticeKind, NoticeCopy>>;
  readonly shared: SharedCopy;
}

/**
 * The wording lives in the adapter, not in the app's translation files: a
 * message is sent from server code and its language is chosen when it is
 * sent (`resolveMailLocale`). `{service}` and `{zone}` are the placeholders.
 * A `Record<Locale, …>`: adding a locale to the app does not compile until
 * it has words here.
 */
const COPY: Record<Locale, LocaleCopy> = {
  de: {
    greeting: 'Hallo {name},',
    calendarAttached: 'Den Termin finden Sie auch als Kalenderdatei im Anhang.',
    manage: {
      label: 'Termin ansehen oder ändern',
      note: 'Ihre Referenz ist schon eingetragen; zur Bestätigung geben Sie dort Ihre E-Mail-Adresse ein.',
    },
    calendar: {
      filename: 'termin.ics',
      reminder: 'In einer Stunde: {service}',
      reference: 'Referenz',
      documents: 'Bitte mitbringen',
      instructions: 'Hinweise',
    },
    notice: {
      confirmed: {
        title: 'Ihr Termin ist bestätigt',
        subject: 'Termin bestätigt: {service}, {date}',
        intro: 'Ihr Termin „{service}“ ist bestätigt.',
        outro:
          'Zum Ändern oder Absagen brauchen Sie die Referenz und diese E-Mail-Adresse. Bitte heben Sie diese Nachricht auf.',
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
        outro:
          'Zum Ändern oder Absagen brauchen Sie die Referenz und diese E-Mail-Adresse. Bitte heben Sie diese Nachricht auf.',
      },
    },
    shared: {
      when: 'Wann',
      where: 'Wo',
      reference: 'Referenz',
      participants: 'Personen',
      documents: 'Bitte mitbringen',
      instructions: 'Hinweise',
      zoneNote: 'Ortszeit ({zone})',
    },
  },
  en: {
    greeting: 'Hello {name},',
    calendarAttached: 'You will also find the appointment as a calendar file attached.',
    manage: {
      label: 'View or change appointment',
      note: 'Your reference is already filled in; confirm with your email address there.',
    },
    calendar: {
      filename: 'appointment.ics',
      reminder: 'In one hour: {service}',
      reference: 'Reference',
      documents: 'Please bring',
      instructions: 'Notes',
    },
    notice: {
      confirmed: {
        title: 'Your appointment is confirmed',
        subject: 'Appointment confirmed: {service}, {date}',
        intro: 'Your appointment “{service}” is confirmed.',
        outro:
          'To change or cancel it you need the reference and this e-mail address. Please keep this message.',
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
        outro:
          'To change or cancel it you need the reference and this e-mail address. Please keep this message.',
      },
    },
    shared: {
      when: 'When',
      where: 'Where',
      reference: 'Reference',
      participants: 'People',
      documents: 'Please bring',
      instructions: 'Notes',
      zoneNote: 'local time ({zone})',
    },
  },
};

const NOON_UTC = 12;

/**
 * The date and time as the clock at the location shows them. The wall-clock
 * parts are formatted as if they were UTC so the machine's zone and the
 * recipient's zone take no part.
 */
function formatWhen(notice: BookingNotice, locale: Locale, zoneNote: string): string {
  const [year = 0, month = 1, day = 1] = notice.localDate.split('-').map(Number);
  const [hour = 0, minute = 0] = notice.localTime.split(':').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, NOON_UTC));
  const time = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const dateText = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(
    date,
  );
  const timeText = new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: 'UTC' }).format(
    time,
  );
  return `${dateText}, ${timeText} (${zoneNote.replace('{zone}', notice.timeZone)})`;
}

/** The day alone and short, for the subject line ("Tue, Jan 5"): the inbox shows only the first words. */
function formatShortDate(notice: BookingNotice, locale: Locale): string {
  const [year = 0, month = 1, day = 1] = notice.localDate.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, NOON_UTC)));
}

/** A subject is one line: whatever an administrator typed into a service name cannot add a header or a break. */
function oneLine(text: string): string {
  return text.replaceAll(/\s+/gu, ' ').trim();
}

/** Renders the message for one change to a booking, in the recipient's language and the website's look. */
export function renderBookingEmail(
  notice: BookingNotice,
  locale: Locale,
  brand: EmailBrand,
  /** The address of the booking on the website; `null` when it is not known. */
  manageUrl: string | null = null,
): RenderedEmail {
  const copy = COPY[locale];
  const { shared } = copy;
  const { title, subject, intro, outro } = copy.notice[notice.kind];
  const name = notice.recipientName?.trim() ?? '';

  const facts = [
    { label: shared.when, value: formatWhen(notice, locale, shared.zoneNote) },
    {
      label: shared.where,
      value: [notice.locationName, notice.locationAddress]
        .filter((part) => part !== null)
        .join(', '),
    },
    { label: shared.reference, value: notice.reference, style: 'code' as const },
    notice.participants > 1
      ? { label: shared.participants, value: String(notice.participants) }
      : null,
    notice.kind !== 'cancelled' && notice.requiredDocuments.length > 0
      ? { label: shared.documents, value: notice.requiredDocuments.join(', ') }
      : null,
    notice.kind !== 'cancelled' && notice.instructions !== null
      ? { label: shared.instructions, value: notice.instructions }
      : null,
  ].filter((fact) => fact !== null);

  return renderEmail(
    {
      locale,
      title,
      subject: oneLine(
        subject
          .replace('{service}', notice.serviceName)
          .replace('{date}', formatShortDate(notice, locale)),
      ),
      ...(name === '' ? {} : { greeting: copy.greeting.replace('{name}', name) }),
      intro: intro.replace('{service}', notice.serviceName),
      facts,
      action:
        manageUrl !== null && notice.kind !== 'cancelled'
          ? { label: copy.manage.label, url: manageUrl, note: copy.manage.note }
          : null,
      outro: hasCalendarFile(notice) ? `${outro} ${copy.calendarAttached}` : outro,
    },
    brand,
  );
}

/** A cancelled appointment has nothing to put in a calendar: the entry made earlier is the person's to remove. */
function hasCalendarFile(notice: BookingNotice): boolean {
  return notice.kind !== 'cancelled';
}

/** The appointment as a calendar file, for the messages that confirm or move it; `null` for one that cancels it. */
export function renderBookingCalendar(
  notice: BookingNotice,
  locale: Locale,
  now: Date,
): CalendarFile | null {
  return hasCalendarFile(notice)
    ? renderBookingCalendarFile(notice, COPY[locale].calendar, oneLine(notice.serviceName), now)
    : null;
}
