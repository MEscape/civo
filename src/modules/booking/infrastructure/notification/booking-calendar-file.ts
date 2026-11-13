import { APP_IDENTITY } from '@lib/config';
import type { MailAttachment } from '@lib/mail';

import type { Instant } from '../../domain/time/instant';

/** What a calendar entry holds: plain text, already in the message's language. */
export interface CalendarEntry {
  /** The booking number: the same booking is the same event, by mail or by any later message. */
  readonly reference: string;
  readonly start: Instant;
  readonly end: Instant;
  /** How often the booking was moved: a calendar replaces an entry only for a higher number. */
  readonly sequence: number;
  readonly summary: string;
  readonly location: string;
  readonly description: string;
  readonly reminder: string;
  readonly filename: string;
}

const PRODUCT_ID = `-//${APP_IDENTITY.company}//${APP_IDENTITY.name}//EN`;
const UID_DOMAIN = APP_IDENTITY.name.toLowerCase();
const LINE_BREAK = '\r\n';
/** A line is at most 75 bytes; a longer one goes on after a line break and a space. */
const MAX_LINE_BYTES = 75;
const REMINDER_MINUTES = 60;
const encoder = new TextEncoder();

/** Backslash, semicolon, comma and line breaks carry meaning in this format. */
function escapeText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll(/\r\n|\r|\n/gu, '\\n');
}

/** `20270105T090000Z`: in UTC, so every calendar puts it at the same moment. */
function utcStamp(epochMs: number): string {
  return new Date(epochMs)
    .toISOString()
    .replaceAll(/[-:]/gu, '')
    .replace(/\.\d{3}/u, '');
}

/** Folds a line at 75 bytes without cutting a character in two. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > MAX_LINE_BYTES) {
      parts.push(current);
      current = '';
      bytes = 1; // the space that starts a continuation line counts
    }
    current += character;
    bytes += size;
  }
  parts.push(current);
  return parts.join(`${LINE_BREAK} `);
}

/**
 * The appointment as an iCalendar file (RFC 5545) to attach to a message: opened, it puts the
 * appointment into the person's calendar with a reminder an hour before. The same `UID` with a
 * higher `SEQUENCE` replaces the entry instead of adding a second. `PUBLISH` without an organizer:
 * an invitation would need a mailbox to answer to.
 */
export function renderCalendarFile(entry: CalendarEntry, now: Date): MailAttachment {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODUCT_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${entry.reference}@${UID_DOMAIN}`,
    `DTSTAMP:${utcStamp(now.getTime())}`,
    `DTSTART:${utcStamp(entry.start)}`,
    `DTEND:${utcStamp(entry.end)}`,
    `SEQUENCE:${entry.sequence}`,
    'STATUS:CONFIRMED',
    `SUMMARY:${escapeText(entry.summary)}`,
    `LOCATION:${escapeText(entry.location)}`,
    `DESCRIPTION:${escapeText(entry.description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:-PT${REMINDER_MINUTES}M`,
    `DESCRIPTION:${escapeText(entry.reminder)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return {
    filename: entry.filename,
    content: lines.map(fold).join(LINE_BREAK) + LINE_BREAK,
    contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
  };
}
