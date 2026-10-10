export interface CalendarFileInput {
  /** A stable identifier for the event; the booking reference. */
  readonly uid: string;
  readonly title: string;
  /** ISO-8601 instants. */
  readonly start: string;
  readonly end: string;
  readonly location: string | null;
  readonly description: string | null;
}

const LINE_BREAK = '\r\n';
const FOLD_AT = 73;

/** `2026-10-12T08:00:00.000Z` -> `20261012T080000Z`. */
function toIcsInstant(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Long lines are folded as the format requires: a break followed by one space. */
function fold(line: string): string {
  if (line.length <= FOLD_AT) {
    return line;
  }
  const parts: string[] = [];
  for (let at = 0; at < line.length; at += FOLD_AT) {
    parts.push(line.slice(at, at + FOLD_AT));
  }
  return parts.join(`${LINE_BREAK} `);
}

/**
 * An iCalendar file for one appointment, so the visitor can put it in their
 * own calendar. Times are written in UTC, which every calendar converts to
 * the visitor's zone; the event is the same instant everywhere.
 */
export function buildCalendarFile(input: CalendarFileInput, stamp: Date): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Civo//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}@civo.booking`,
    `DTSTAMP:${toIcsInstant(stamp.toISOString())}`,
    `DTSTART:${toIcsInstant(input.start)}`,
    `DTEND:${toIcsInstant(input.end)}`,
    `SUMMARY:${escapeText(input.title)}`,
    ...(input.location === null ? [] : [`LOCATION:${escapeText(input.location)}`]),
    ...(input.description === null ? [] : [`DESCRIPTION:${escapeText(input.description)}`]),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join(LINE_BREAK)}${LINE_BREAK}`;
}
