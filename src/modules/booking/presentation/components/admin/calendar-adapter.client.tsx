'use client';

import { useRef, useState } from 'react';

import deLocale from '@fullcalendar/core/locales/de';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';

import { cn, MS_PER_DAY } from '@lib/utils';

import { CalendarToolbar } from './calendar-toolbar';

import type {
  CalendarAdapterEvent,
  CalendarLabels,
  CalendarRange,
  CalendarTone,
  CalendarViewName,
} from '../../calendar/calendar-model';
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core';

/**
 * THE ONLY FILE THAT KNOWS FULLCALENDAR. The rest of the module speaks the
 * neutral model below, so the library can be upgraded or replaced by changing
 * this file alone. Only MIT-licensed packages are used (core, react,
 * daygrid, timegrid, list); the premium scheduler views are not needed.
 *
 * Time zones: FullCalendar can only render named zones with an extra plugin.
 * Instead, the server sends each event as WALL-CLOCK text of the location
 * (`2026-10-12T10:00:00`) and the calendar is told its zone is UTC, so what
 * is drawn is exactly what the clock at the location shows, on every device,
 * with no conversion left to get wrong.
 */

export interface CalendarAdapterProps {
  readonly events: readonly CalendarAdapterEvent[];
  readonly locale: string;
  readonly labels: CalendarLabels;
  readonly initialView: CalendarViewName;
  readonly onRangeChange: (range: CalendarRange) => void;
  readonly onEventSelect: (id: string) => void;
}

const VIEW_BY_NAME = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
  list: 'listWeek',
} as const satisfies Record<CalendarViewName, string>;

const TONE_COLORS: Readonly<
  Record<CalendarTone, { background: string; border: string; text: string }>
> = {
  success: {
    background: 'var(--color-success-subtle)',
    border: 'var(--color-success-border)',
    text: 'var(--color-success)',
  },
  info: {
    background: 'var(--color-info-subtle)',
    border: 'var(--color-info-border)',
    text: 'var(--color-info)',
  },
  warning: {
    background: 'var(--color-warning-subtle)',
    border: 'var(--color-warning-border)',
    text: 'var(--color-warning)',
  },
  danger: {
    background: 'var(--color-danger-subtle)',
    border: 'var(--color-danger-border)',
    text: 'var(--color-danger)',
  },
  muted: {
    background: 'var(--color-canvas)',
    border: 'var(--color-border-strong)',
    text: 'var(--color-copy-muted)',
  },
};

const NARROW_SCREEN_QUERY = '(max-width: 40rem)';
const DATE_LENGTH = 10;

/** FullCalendar reports the visible range with an exclusive end, as UTC midnights. */
function toRange(arg: DatesSetArg): CalendarRange {
  return {
    from: arg.start.toISOString().slice(0, DATE_LENGTH),
    to: new Date(arg.end.getTime() - MS_PER_DAY).toISOString().slice(0, DATE_LENGTH),
  };
}

export function CalendarAdapter({
  events,
  locale,
  labels,
  initialView,
  onRangeChange,
  onEventSelect,
}: CalendarAdapterProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState<CalendarViewName>(() =>
    window.matchMedia(NARROW_SCREEN_QUERY).matches ? 'list' : initialView,
  );
  const [title, setTitle] = useState('');

  function api() {
    return calendarRef.current?.getApi();
  }

  function handleDatesSet(arg: DatesSetArg) {
    setTitle(arg.view.title);
    onRangeChange(toRange(arg));
  }

  function handleEventClick(arg: EventClickArg) {
    arg.jsEvent.preventDefault();
    onEventSelect(arg.event.id);
  }

  return (
    <div className="space-y-3">
      <CalendarToolbar
        title={title}
        labels={labels}
        view={view}
        onPrevious={() => api()?.prev()}
        onToday={() => api()?.today()}
        onNext={() => api()?.next()}
        onViewChange={(name) => {
          setView(name);
          api()?.changeView(VIEW_BY_NAME[name]);
        }}
      />

      <div
        className={cn(
          'text-sm text-copy',
          '[--fc-border-color:var(--color-border)] [--fc-page-bg-color:var(--color-surface)]',
          '[--fc-neutral-bg-color:var(--color-canvas)] [--fc-today-bg-color:var(--color-info-subtle)]',
          '[--fc-list-event-hover-bg-color:var(--color-canvas)] [--fc-now-indicator-color:var(--color-danger)]',
          '[&_.fc-event]:cursor-pointer [&_.fc-event:focus-visible]:outline-2 [&_.fc-event:focus-visible]:outline-accent',
        )}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          initialView={VIEW_BY_NAME[view]}
          headerToolbar={false}
          timeZone="UTC"
          locales={[deLocale]}
          locale={locale}
          firstDay={1}
          height="auto"
          nowIndicator={false}
          dayMaxEvents={3}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          eventInteractive
          noEventsContent={labels.noEvents}
          events={events.map((event) => ({
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            backgroundColor: TONE_COLORS[event.tone].background,
            borderColor: TONE_COLORS[event.tone].border,
            textColor: TONE_COLORS[event.tone].text,
          }))}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
        />
      </div>
    </div>
  );
}
