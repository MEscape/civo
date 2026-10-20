import { APP_IDENTITY } from '@lib/config';

import type { BookingNotice } from '../../domain/ports/booking-notifier.port';

/** What a calendar entry says, in the language of the message; the facts come from the notice. */
export interface CalendarCopy {
  /** The name of the attached file. */
  readonly filename: string;
  /** The reminder's text. `{service}` is the appointment. */
  readonly reminder: string;
  readonly reference: string;
  readonly documents: string;
  readonly instructions: string;
}

export interface CalendarFile {
  readonly filename: string;
  readonly content: string;
  readonly contentType: string;
}

/** Who made the file, in the form the format asks for. The download in `presentation/calendar` writes the same one. */
const PRODUCT_ID = `-//${APP_IDENTITY.company}//${APP_IDENTITY.name}//EN`;
/** The same booking is the same event whether it came by mail or by download, so a calendar updates it instead of adding a second. */
const UID_DOMAIN = APP_IDENTITY.name.toLowerCase();
const LINE_BREAK = '\r\n';
/** A line of a calendar file is at most 75 bytes; a longer one continues on the next after a space. */
const MAX_LINE_BYTES = 75;
const REMINDER_MINUTES = 60;

/** Escapes a text value: backslash, semicolon, comma and line breaks carry meaning in this format. */
function escapeText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll(/\r\n|\r|\n/gu, '\\n');
}

/** `20270105T090000Z`: an instant in UTC, so every calendar puts it at the same moment. */
function formatInstant(date: Date): string {
  return date
    .toISOString()
    .replaceAll(/[-:]/gu, '')
    .replace(/\.\d{3}/u, '');
}

/** Folds a line at 75 bytes without cutting a character in two. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  // The continuation lines start with a space, which counts toward their 75.
  let limit = MAX_LINE_BYTES;
  for (const character of line) {
    const size = Buffer.byteLength(character, 'utf8');
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 1;
      limit = MAX_LINE_BYTES;
    }
    current += character;
    bytes += size;
  }
  parts.push(current);
  return parts.join(`${LINE_BREAK} `);
}

/**
 * The appointment as a calendar file to attach to the message: opened, it
 * puts the appointment in the person's own calendar with a reminder an hour
 * before. The same `UID` with a higher `SEQUENCE` (it follows the number of
 * times the booking was moved) makes the calendar replace the entry instead of
 * adding a second one. Plain `PUBLISH`, with no organizer: a message to sign
 * a person up to something needs a mailbox to answer from, and this is a file.
 */
export function renderBookingCalendarFile(
  notice: BookingNotice,
  { copy, summary, now }: { copy: CalendarCopy; summary: string; now: Date },
): CalendarFile {
  const where = [notice.locationName, notice.locationAddress].filter((part) => part !== null);
  const description = [
    `${copy.reference}: ${notice.reference}`,
    notice.requiredDocuments.length > 0
      ? `${copy.documents}: ${notice.requiredDocuments.join(', ')}`
      : null,
    notice.instructions === null ? null : `${copy.instructions}: ${notice.instructions}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODUCT_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${notice.reference}@${UID_DOMAIN}`,
    `DTSTAMP:${formatInstant(now)}`,
    `DTSTART:${formatInstant(notice.startsAt)}`,
    `DTEND:${formatInstant(notice.endsAt)}`,
    `SEQUENCE:${notice.sequence}`,
    'STATUS:CONFIRMED',
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText(where.join(', '))}`,
    `DESCRIPTION:${escapeText(description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:-PT${REMINDER_MINUTES}M`,
    `DESCRIPTION:${escapeText(copy.reminder.replace('{service}', summary))}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return {
    filename: copy.filename,
    content: lines.map(fold).join(LINE_BREAK) + LINE_BREAK,
    contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
  };
}
