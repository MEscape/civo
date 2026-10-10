'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { Button } from '@components/ui/button';
import { Skeleton } from '@components/ui/skeleton';

import { useLocale, useTranslations } from '@i18n/client';

import { getOperationsCalendarAction } from '../../actions/get-operations-calendar-action';
import { ErrorNotice } from '../shared/error-notice';
import { SelectField } from '../shared/select-field';

import { BookingDetailsPanel } from './booking-details-panel.client';
import { CalendarView } from './calendar-view.client';

import type { CalendarAdapterEvent, CalendarRange, CalendarTone } from './calendar-adapter.client';
import type { BookingStatus } from '../../../application/contracts/booking-constraints';
import type { CalendarBookingDto, OperationsCalendarDto } from '../../dto/calendar-dto';
import type { BookingSetupDto } from '../../dto/setup-dto';

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

/** The filter value for "no filter"; a real id is never this word. */
const ALL = 'all';

type Outcome =
  | { readonly kind: 'ready'; readonly calendar: OperationsCalendarDto }
  | { readonly kind: 'failed'; readonly code: string };

function readyCalendar(outcome: Outcome | null): OperationsCalendarDto | null {
  return outcome?.kind === 'ready' ? outcome.calendar : null;
}

interface Loaded {
  readonly key: string;
  readonly outcome: Outcome;
}

function titleOf(booking: CalendarBookingDto): string {
  const who = booking.customerName ?? booking.reference;
  return `${booking.serviceName} · ${who}`;
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
  const id = useId();

  const [range, setRange] = useState<CalendarRange | null>(null);
  const [locationId, setLocationId] = useState(ALL);
  const [serviceId, setServiceId] = useState(ALL);
  const [resourceId, setResourceId] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const requestKey =
    range === null
      ? null
      : `${range.from}|${range.to}|${locationId}|${serviceId}|${resourceId}|${version}`;

  useEffect(() => {
    if (range === null || requestKey === null) {
      return undefined;
    }
    let cancelled = false;
    void getOperationsCalendarAction({
      websiteId,
      from: range.from,
      to: range.to,
      ...(locationId === ALL ? {} : { locationId }),
      ...(serviceId === ALL ? {} : { serviceId }),
      ...(resourceId === ALL ? {} : { resourceId }),
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setLoaded({
        key: requestKey,
        outcome: result.ok
          ? { kind: 'ready', calendar: result.data }
          : { kind: 'failed', code: result.error.code },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [websiteId, range, requestKey, locationId, serviceId, resourceId]);

  const outcome = loaded?.key === requestKey ? loaded.outcome : null;
  // Keep showing the last good data while the next range loads, so the calendar does not flash empty.
  const shown = readyCalendar(outcome) ?? readyCalendar(loaded?.outcome ?? null);

  const events: readonly CalendarAdapterEvent[] = useMemo(
    () =>
      (shown?.bookings ?? []).map((booking) => ({
        id: booking.id,
        title: titleOf(booking),
        start: booking.startLocal,
        end: booking.endLocal,
        tone: TONE_BY_STATUS[booking.status],
      })),
    [shown],
  );

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

  const handleRange = useCallback((next: CalendarRange) => {
    setRange((current) => (current?.from === next.from && current.to === next.to ? current : next));
  }, []);
  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const resourcesForFilter = setup.resources.filter(
    (resource) =>
      locationId === ALL || resource.locationId === null || resource.locationId === locationId,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          id={`${id}-location`}
          label={t('calendar.filterLocation')}
          value={locationId}
          options={[
            { value: ALL, label: t('calendar.firstLocation') },
            ...setup.locations.map((location) => ({ value: location.id, label: location.name })),
          ]}
          onValueChange={(value) => {
            setLocationId(value);
            setResourceId(ALL);
          }}
        />
        <SelectField
          id={`${id}-service`}
          label={t('calendar.filterService')}
          value={serviceId}
          options={[
            { value: ALL, label: t('calendar.allServices') },
            ...setup.services.map((service) => ({ value: service.id, label: service.name })),
          ]}
          onValueChange={setServiceId}
        />
        <SelectField
          id={`${id}-resource`}
          label={t('calendar.filterResource')}
          value={resourceId}
          options={[
            { value: ALL, label: t('calendar.allResources') },
            ...resourcesForFilter.map((resource) => ({ value: resource.id, label: resource.name })),
          ]}
          onValueChange={setResourceId}
        />
      </div>

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
            onRangeChange={handleRange}
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
