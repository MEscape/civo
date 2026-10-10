import type { Locale } from '@i18n';

import { renderEmail } from '@lib/mail';
import type { RenderedEmail } from '@lib/mail';

import type { BookingNotice, BookingNoticeKind } from '../../domain/ports/booking-notifier.port';

interface NoticeCopy {
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
    notice: {
      confirmed: {
        subject: 'Ihr Termin ist bestätigt',
        intro: 'Ihr Termin „{service}“ ist bestätigt.',
        outro:
          'Zum Ändern oder Absagen brauchen Sie die Referenz und diese E-Mail-Adresse. Bitte heben Sie diese Nachricht auf.',
      },
      cancelled: {
        subject: 'Ihr Termin wurde abgesagt',
        intro: 'Ihr Termin „{service}“ wurde abgesagt.',
        outro: 'Sie können jederzeit einen neuen Termin buchen.',
      },
      rescheduled: {
        subject: 'Ihr Termin wurde verschoben',
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
    notice: {
      confirmed: {
        subject: 'Your appointment is confirmed',
        intro: 'Your appointment “{service}” is confirmed.',
        outro:
          'To change or cancel it you need the reference and this e-mail address. Please keep this message.',
      },
      cancelled: {
        subject: 'Your appointment was cancelled',
        intro: 'Your appointment “{service}” was cancelled.',
        outro: 'You can book a new appointment at any time.',
      },
      rescheduled: {
        subject: 'Your appointment was moved',
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

/** Renders the message for one change to a booking, in the recipient's language. */
export function renderBookingEmail(notice: BookingNotice, locale: Locale): RenderedEmail {
  const copy = COPY[locale];
  const { shared } = copy;
  const { subject, intro, outro } = copy.notice[notice.kind];

  const facts = [
    { label: shared.when, value: formatWhen(notice, locale, shared.zoneNote) },
    {
      label: shared.where,
      value: [notice.locationName, notice.locationAddress]
        .filter((part) => part !== null)
        .join(', '),
    },
    { label: shared.reference, value: notice.reference },
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

  return renderEmail({
    locale,
    title: subject,
    intro: intro.replace('{service}', notice.serviceName),
    facts,
    outro,
  });
}
