'use client';

import type { ReactNode } from 'react';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import listPlugin from '@fullcalendar/react/list';
import deLocale from '@fullcalendar/react/locales/de';
import themePlugin from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';

import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';

import { cn } from '@lib/utils';

import type { CalendarView } from '../../schemas/parse-booking-list-input';

/**
 * THE ONLY FILE THAT KNOWS FULLCALENDAR (the MIT `@fullcalendar/react` package and its day grid, time grid and list views;
 * `calendar-isolation.test.ts` keeps it that way). The rest of the module speaks the neutral props
 * below, so the library can be replaced by changing this file alone.
 *
 * Time zones: each entry arrives as the WALL-CLOCK text of its own location (`2027-01-12T09:30:00`)
 * and the calendar is told its zone is UTC, so what is drawn is what the clock at the location shows
 * (BD-02), on every device, with nothing left to convert. The current-time line stays off: in this
 * mode it would show UTC.
 */

/** One booking as the calendar draws it. */
export interface CalendarEntry {
  readonly id: string;
  readonly title: string;
  /** Wall-clock text of the location, without an offset. */
  readonly start: string;
  readonly end: string;
  /** Still waits for an employee: drawn with a dashed edge, besides what its label says. */
  readonly isOpen: boolean;
  /** Over without taking place (cancelled, expired): drawn faded, besides what its label says. */
  readonly isFaded: boolean;
  /** How the box is tinted: an entry that needs an employee, one that did not take place as agreed, or a plain one. */
  readonly tone: 'plain' | 'open' | 'danger';
}

export interface CalendarAdapterProps {
  readonly entries: readonly CalendarEntry[];
  readonly view: CalendarView;
  /** A day of the period shown, `YYYY-MM-DD`. */
  readonly date: string;
  readonly locale: string;
  readonly noEventsLabel: string;
  /** The link that opens the entries a cell or a column could not hold: "+3 more". */
  readonly moreLabel: (count: number) => string;
  /** The inside of an entry: its time, what it is, and its state as icon and word. */
  readonly renderEntry: (id: string, timeText: string) => ReactNode;
  readonly onSelect: (id: string) => void;
}

const VIEW_BY_NAME = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
  list: 'listWeek',
} as const satisfies Record<CalendarView, string>;

/** Hours as the 24-hour clock in every language: the day is read as "07:00", never "7am", as the rest of the module writes times. */
const CLOCK_24 = { hour: '2-digit', minute: '2-digit', hour12: false } as const;

/** How many entries of the same time share a column of the time grid before the rest fold into "+ more": a day's column is wide, a week's is not. */
/** Pixels a half hour of the time grid is at least tall, and an entry is at least: a quarter of an hour still shows as a box one can press. */
const SLOT_MIN_HEIGHT = 36;
const EVENT_MIN_HEIGHT = 22;
const DAY_SIDE_BY_SIDE = 6;
const WEEK_SIDE_BY_SIDE = 2;

/** What a box looks like: the theme's solid blue is replaced by the module's own tints, one per tone, with the state also an icon and a word inside. */
const TONES = {
  plain: '!border-primary/40 !bg-primary/10 hover:!bg-primary/20',
  open: '!border-dashed !border-warning-border !bg-warning-subtle hover:!bg-warning-subtle/70',
  danger: '!border-danger-border !bg-danger-subtle hover:!bg-danger-subtle/70',
} as const;

/** The class of a box: its tone's tint (a plain row of the list stays unfilled), faded when it did not take place. */
const eventClassFor =
  (view: CalendarView) =>
  (info: { readonly event: { readonly extendedProps: Record<string, unknown> } }): string => {
    const { tone, isFaded } = info.event.extendedProps;
    const toneKey = tone === 'open' || tone === 'danger' ? tone : 'plain';
    const isPlainRow = view === 'list' && toneKey === 'plain';
    return cn(!isPlainRow && TONES[toneKey], isFaded === true && 'opacity-60');
  };

const DEFAULT_FIRST_HOUR = 7;
const DEFAULT_LAST_HOUR = 19;
const HOURS_PER_DAY = 24;

const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00:00`;
/** The hour and minute a wall-clock text (`2027-01-12T09:30:00`) falls at. */
const timeOfDay = (text: string) => {
  const [hour = '0', minute = '0'] = text.slice(text.indexOf('T') + 1).split(':');
  return { hour: Number(hour), minute: Number(minute) };
};

/** The hours the time grid draws: the working day, widened to hold any booking outside it, so no entry is cut off. */
function visibleHours(entries: readonly CalendarEntry[]) {
  const first = Math.min(DEFAULT_FIRST_HOUR, ...entries.map(({ start }) => timeOfDay(start).hour));
  const last = Math.max(
    DEFAULT_LAST_HOUR,
    ...entries.map(({ end }) => {
      const { hour, minute } = timeOfDay(end);
      return Math.min(HOURS_PER_DAY, minute === 0 ? hour : hour + 1);
    }),
  );
  return { slotMinTime: pad(first), slotMaxTime: pad(last) };
}

export function CalendarAdapter({
  entries,
  view,
  date,
  locale,
  noEventsLabel,
  moreLabel,
  renderEntry,
  onSelect,
}: CalendarAdapterProps) {
  return (
    // A week or a month keeps columns wide enough to read: on a narrow screen it scrolls sideways instead of squeezing.
    <div className="overflow-x-auto">
      <div
        className={cn(
          'text-sm text-copy',
          // The day of today is a faint tint of the module's colour, not the theme's yellow.
          '[--fc-classic-today:color-mix(in_srgb,var(--color-primary)_6%,transparent)]',
          view === 'week' && 'min-w-208',
          view === 'month' && 'min-w-176',
          // The library's class names are hashed, so entries are found by what they are: pressable boxes.
          '[&_[role=listitem]>[role=button]]:cursor-pointer',
          '[&_[role=listitem]>[role=button]:focus-visible]:outline-2 [&_[role=listitem]>[role=button]:focus-visible]:outline-accent',
          // The time grid keeps a strip free on the right of each column (to click a new entry into): there is none to click here, so the entries take the whole column.
          view !== 'month' && '[&_[role=list]:has(>[role=listitem])]:me-0.5!',
        )}
      >
        <FullCalendar
          key={`${view}-${date}`}
          plugins={[themePlugin, dayGridPlugin, timeGridPlugin, listPlugin]}
          initialView={VIEW_BY_NAME[view]}
          initialDate={date}
          headerToolbar={false}
          timeZone="UTC"
          locales={[deLocale]}
          locale={locale}
          firstDay={1}
          height="auto"
          nowIndicator={false}
          allDaySlot={false}
          slotHeaderFormat={CLOCK_24}
          eventTimeFormat={CLOCK_24}
          {...visibleHours(entries)}
          dayMaxEvents={3}
          eventMaxStack={view === 'day' ? DAY_SIDE_BY_SIDE : WEEK_SIDE_BY_SIDE}
          slotEventOverlap={false}
          eventClass={eventClassFor(view)}
          eventDisplay={view === 'month' ? 'block' : 'auto'}
          slotMinHeight={SLOT_MIN_HEIGHT}
          eventMinHeight={EVENT_MIN_HEIGHT}
          moreLinkText={moreLabel}
          eventInteractive
          noEventsContent={noEventsLabel}
          events={entries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            start: entry.start,
            end: entry.end,
            extendedProps: { tone: entry.tone, isFaded: entry.isFaded },
          }))}
          eventContent={(arg) => renderEntry(arg.event.id, arg.timeText)}
          eventClick={(arg) => {
            arg.jsEvent.preventDefault();
            onSelect(arg.event.id);
          }}
        />
      </div>
    </div>
  );
}
