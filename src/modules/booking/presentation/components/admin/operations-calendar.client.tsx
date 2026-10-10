'use client';

import { useMemo, useState } from 'react';

import { Button } from '@components/ui/button';
import { Skeleton } from '@components/ui/skeleton';

import { useLocale, useTranslations } from '@i18n/client';

import { ALL_FILTER, useOperationsCalendar } from '../../hooks/use-operations-calendar';
import { ErrorNotice } from '../shared/error-notice';

import { BookingDetailsPanel } from './booking-details-panel.client';
import { CalendarFilters } from './calendar-filters';
import { CalendarView } from './calendar-view.client';

import type { BookingStatus } from '../../../application/contracts/booking-constraints';
import type { CalendarAdapterEvent, CalendarTone } from '../../calendar/calendar-model';
import type { CalendarBookingDto } from '../../dto/calendar-dto';
import type { BookingSetupDto } from '../../dto/setup-dto';
import type { CalendarFilters as Filters } from '../../hooks/use-operations-calendar';

export interface OperationsCalendarProps {
  readonly websiteId: string;
  readonly setup: BookingSetupDto;
  /** Whether the signed-in person may change bookings (`booking.manage`), not just read them. */
  readonly canManage: boolean;
}

const TONE_BY_STATUS = {
  held: 'warning',
  confirmed: 'success',
  cancelled: 'muted',
  completed: 'info',
  no_show: 'danger',
  expired: 'muted',
} as const satisfies Record<BookingStatus, CalendarTone>;

const NO_FILTERS: Filters = {
  locationId: ALL_FILTER,
  serviceId: ALL_FILTER,
  resourceId: ALL_FILTER,
};

function titleOf(booking: CalendarBookingDto): string {
  const who = booking.customerName ?? booking.reference;
  return `${booking.serviceName} · ${who}`;
}

function toEvent(booking: CalendarBookingDto): CalendarAdapterEvent {
  return {
    id: booking.id,
    title: titleOf(booking),
    start: booking.startLocal,
    end: booking.endLocal,
    tone: TONE_BY_STATUS[booking.status],
  };
}

/**
 * The operations calendar: every booking of the website over the visible
 * range, filterable by location, service and resource. The calendar widget
 * is reached only through the adapter; this component works with plain
 * events, so it neither knows nor cares which library draws them.
 */
export function OperationsCalendar({ websiteId, setup, canManage }: OperationsCalendarProps) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { range, outcome, shown, changeRange, refresh } = useOperationsCalendar(websiteId, filters);

  const events = useMemo(() => (shown?.bookings ?? []).map(toEvent), [shown]);
  const selected = shown?.bookings.find((booking) => booking.id === selectedId) ?? null;
  const labels = useMemo(
    () => ({
      today: t('calendar.today'),
      previous: t('calendar.previous'),
      next: t('calendar.next'),
      viewGroup: t('calendar.viewGroup'),
      noEvents: t('calendar.noEvents'),
      views: {
        month: t('calendar.views.month'),
        week: t('calendar.views.week'),
        day: t('calendar.views.day'),
        list: t('calendar.views.list'),
      },
    }),
    [t],
  );

  return (
    <div className="space-y-4">
      <CalendarFilters setup={setup} filters={filters} onChange={setFilters} />

      {outcome?.kind === 'failed' && (
        <div className="space-y-2">
          <ErrorNotice code={outcome.code} />
          <Button type="button" variant="outline" onClick={refresh}>
            {t('calendar.retry')}
          </Button>
        </div>
      )}

      {setup.locations.length === 0 ? (
        <p
          role="status"
          className="rounded-token border border-border bg-canvas p-4 text-sm text-copy"
        >
          {t('calendar.noLocations')}
        </p>
      ) : (
        <div className="relative" aria-busy={outcome === null}>
          <CalendarView
            events={events}
            locale={locale}
            labels={labels}
            initialView="week"
            onRangeChange={changeRange}
            onEventSelect={setSelectedId}
          />
          {outcome === null && range !== null && (
            <div className="pointer-events-none absolute inset-x-0 top-0">
              <Skeleton className="h-1 w-full" />
              <p role="status" className="sr-only">
                {t('calendar.loading')}
              </p>
            </div>
          )}
        </div>
      )}

      {selected !== null && (
        <BookingDetailsPanel
          websiteId={websiteId}
          booking={selected}
          setup={setup}
          canManage={canManage}
          timeZone={shown?.timeZone ?? 'UTC'}
          onChanged={refresh}
          onClose={() => {
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
