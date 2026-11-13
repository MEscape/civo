'use client';

import { useTranslations } from '@i18n/client';

import { calendarEntryFacts } from '../../forms/calendar-entry-facts';
import { STATUS_MESSAGE_KEYS } from '../../messages/message-keys';
import { BookingStatusChip } from '../shared/booking-status-chip';

import type { BookingDto } from '../../dto/booking-dto';
import type { NameBook } from '../../forms/booking-names';
import type { CalendarView } from '../../schemas/parse-booking-list-input';

/** Below these lengths an entry is too short to hold more than a line, or than two. */
const ONE_LINE_BELOW_MINUTES = 45;
const TWO_LINES_BELOW_MINUTES = 60;

export interface CalendarEntryContentProps {
  readonly booking: BookingDto;
  readonly book: NameBook;
  /** The time as the calendar writes it for this view. */
  readonly timeText: string;
  readonly view: CalendarView;
}

/**
 * What one booking says inside its box on the calendar, by how much room the box has: a month cell
 * (a line), the list (a row with room to spare) and the time grid, where the room is the length of
 * the appointment (one, two or three lines) and the width of its column (the state shrinks to its
 * icon in a narrow one). Whatever is left out is in the tooltip and in the entry's dialog; the state is
 * never left to colour: it is an icon with its word for assistive technology, or the word itself.
 */
export function CalendarEntryContent({ booking, book, timeText, view }: CalendarEntryContentProps) {
  const t = useTranslations('booking');
  const { service, place, minutes, state } = calendarEntryFacts(booking, book);
  const tooltip = [timeText, service, place, t(STATUS_MESSAGE_KEYS[state])].join(' · ');
  const chip = (isIconOnly: boolean) => (
    <BookingStatusChip
      status={booking.status}
      assignment={booking.assignment}
      isIconOnly={isIconOnly}
    />
  );

  if (view === 'list') {
    return (
      <span
        title={tooltip}
        className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-0.5 text-copy"
      >
        <span className="font-semibold tabular-nums">{timeText}</span>
        <span className="font-semibold">{service}</span>
        <span className="text-copy-muted">{place}</span>
        {chip(false)}
      </span>
    );
  }
  if (view === 'month') {
    return (
      <span
        title={tooltip}
        className="flex w-full min-w-0 items-center gap-1 p-0.5 text-xs text-copy"
      >
        {chip(true)}
        <span className="min-w-0 truncate">
          <span className="font-semibold">{timeText}</span> {service}
        </span>
      </span>
    );
  }
  return (
    <span
      title={tooltip}
      className="@container block h-full w-full min-w-0 flex-1 space-y-0.5 overflow-hidden p-0.5 text-xs leading-tight text-copy"
    >
      <span className="flex min-w-0 items-center gap-1">
        {minutes < TWO_LINES_BELOW_MINUTES && chip(true)}
        <span className="min-w-0 truncate font-semibold">
          {timeText}
          <span className="@max-entry-narrow:hidden"> {service}</span>
        </span>
      </span>
      {minutes >= ONE_LINE_BELOW_MINUTES && (
        <span className="block truncate text-copy-muted @max-entry-narrow:hidden">{place}</span>
      )}
      {minutes >= TWO_LINES_BELOW_MINUTES && (
        <span className="block">
          <span className="@max-entry-tight:hidden">{chip(false)}</span>
          <span className="hidden @max-entry-tight:inline">{chip(true)}</span>
        </span>
      )}
    </span>
  );
}
