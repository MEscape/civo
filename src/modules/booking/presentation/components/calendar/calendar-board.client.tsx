'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@components/ui/skeleton';

import { useTranslations } from '@i18n/client';

import { bookingDetailsHref } from '../../forms/booking-list-href';
import { displayStateOf, nameBookOf } from '../../forms/booking-names';
import { wallClockOf } from '../../forms/calendar-range';
import { useCalendarSelection } from '../../hooks/use-calendar-selection';
import { AssignDialog } from '../bookings/assign-dialog.client';

import { CalendarEntryContent } from './calendar-entry.client';
import { CalendarEventDetails } from './calendar-event-details.client';
import { CalendarList } from './calendar-list.client';

import type { CalendarEntry as AdapterEntry } from './calendar-adapter.client';
import type { BookingDto, BookingNamesDto } from '../../dto/booking-dto';
import type { NameBook } from '../../forms/booking-names';
import type { CalendarView } from '../../schemas/parse-booking-list-input';

const DAY_PLACEHOLDERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

/** Where the calendar will be, while it is fetched: the grid of its days, with the loading said once. */
function CalendarLoading() {
  const t = useTranslations('booking');
  return (
    <div aria-busy="true" className="space-y-2">
      <p role="status" className="sr-only">
        {t('calendar.loading')}
      </p>
      <div aria-hidden="true" className="grid grid-cols-7 gap-px">
        {DAY_PLACEHOLDERS.map((day) => (
          <Skeleton key={day} className="h-96 rounded-none" />
        ))}
      </div>
    </div>
  );
}

/** FullCalendar is fetched only on this page, and only in the browser. */
const CalendarAdapter = dynamic(
  () => import('./calendar-adapter.client').then((module) => module.CalendarAdapter),
  { ssr: false, loading: CalendarLoading },
);

/** Tints the box of an entry that waits for an employee, or that did not take place as agreed; the rest are plain. */
function toneOf(booking: BookingDto): AdapterEntry['tone'] {
  if (booking.status === 'no_show') {
    return 'danger';
  }
  return displayStateOf(booking) === 'open' ? 'open' : 'plain';
}

const entryOf = (booking: BookingDto, book: NameBook): AdapterEntry => ({
  id: booking.id,
  title: book.service(booking.serviceId),
  start: wallClockOf(booking.start),
  end: wallClockOf(booking.end),
  isOpen: displayStateOf(booking) === 'open',
  isFaded: booking.status === 'cancelled' || booking.status === 'expired',
  tone: toneOf(booking),
});

export interface CalendarBoardProps {
  readonly items: readonly BookingDto[];
  readonly names: BookingNamesDto;
  readonly view: CalendarView;
  readonly date: string;
  readonly locale: string;
  readonly mayManage: boolean;
  /** The bookings list, where "open in the list" leads. */
  readonly listHref: string;
}

/**
 * The calendar of mockup 07: every booking of the period on its location's wall clock (BD-02), its
 * state as icon and word, and a dialog with its details and "Mitarbeiter zuweisen", which opens the
 * same assignment dialog as the list.
 */
export function CalendarBoard({ items, names, mayManage, listHref, ...shown }: CalendarBoardProps) {
  const t = useTranslations('booking');
  const book = nameBookOf(names, t('bookings.list.unknown'));
  const selection = useCalendarSelection(items);
  const { selected } = selection;

  return (
    <>
      {shown.view === 'list' ? (
        <CalendarList items={items} book={book} onSelect={selection.select} />
      ) : (
        <CalendarAdapter
          {...shown}
          noEventsLabel={t('calendar.noEvents')}
          moreLabel={(count) => t('calendar.more', { count })}
          onSelect={selection.select}
          entries={items.map((booking) => entryOf(booking, book))}
          renderEntry={(id, timeText) => {
            const booking = items.find((one) => one.id === id);
            return booking === undefined ? null : (
              <CalendarEntryContent
                booking={booking}
                book={book}
                timeText={timeText}
                view={shown.view}
              />
            );
          }}
        />
      )}
      {selected !== null && (
        <>
          <CalendarEventDetails
            booking={selected}
            book={book}
            isOpen={selection.isDetailsOpen}
            detailsHref={bookingDetailsHref(listHref, selected)}
            mayAssign={mayManage && selection.isOpenForAssignment}
            onAssign={selection.startAssigning}
            onClose={selection.closeDetails}
          />
          <AssignDialog
            dialog={selection.assign}
            subtitle={`${book.service(selected.serviceId)} · ${book.location(selected.locationId)}`}
            nameOf={book.resource}
            timeZone={selected.timeZone}
          />
        </>
      )}
    </>
  );
}
