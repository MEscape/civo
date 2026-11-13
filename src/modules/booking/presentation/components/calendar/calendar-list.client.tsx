'use client';

import { ArrowRight, Calendar } from '@components/icons/icons';
import { ResponsiveTable } from '@components/shared/responsive-table';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { dayOf } from '../../forms/month-calendar';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { BookingEmptyState } from '../shared/booking-empty-state';
import { BookingStatusChip } from '../shared/booking-status-chip';

import type { BookingDto } from '../../dto/booking-dto';
import type { NameBook } from '../../forms/booking-names';

export interface CalendarListProps {
  readonly items: readonly BookingDto[];
  readonly book: NameBook;
  readonly onSelect: (id: string) => void;
}

/**
 * The calendar's "list" view in the module's own table: the bookings of the week in time order, a heading
 * for each day, the same columns and chips as the bookings page, and a row that opens the same
 * details. It is not the calendar library's list, so nothing about it looks like another product.
 */
export function CalendarList({ items, book, onSelect }: CalendarListProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat();
  const columns: ReadonlyArray<ResponsiveColumn<BookingDto>> = [
    {
      id: 'time',
      label: t('bookings.list.columns.time'),
      width: '@3xl:w-44',
      cell: (booking) => (
        <span className="font-semibold text-copy">
          {format.timeRange(booking.start, booking.end, booking.timeZone)}
        </span>
      ),
    },
    {
      id: 'service',
      label: t('bookings.list.columns.service'),
      isTitle: true,
      cell: (booking) => (
        <span className="font-medium text-copy">{book.service(booking.serviceId)}</span>
      ),
    },
    {
      id: 'location',
      label: t('bookings.list.columns.location'),
      cell: (booking) => (
        <span className="text-copy-muted">{book.location(booking.locationId)}</span>
      ),
    },
    {
      id: 'status',
      label: t('bookings.list.columns.status'),
      width: '@3xl:w-32',
      cell: (booking) => (
        <BookingStatusChip status={booking.status} assignment={booking.assignment} />
      ),
    },
    {
      id: 'details',
      label: t('bookings.list.details'),
      isAction: true,
      width: '@3xl:w-32',
      cell: (booking) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('bookings.list.detailsFor', {
              service: book.service(booking.serviceId),
              time: format.dateTime(booking.start, booking.timeZone),
            })}
            onClick={() => {
              onSelect(booking.id);
            }}
          >
            {t('bookings.list.details')}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <ResponsiveTable
      label={t('calendar.views.list')}
      rows={items}
      rowKey={(booking) => booking.id}
      columns={columns}
      density="standard"
      groupHeading={(booking, previous) =>
        previous !== undefined && dayOf(previous.start) === dayOf(booking.start)
          ? null
          : format.longDate(booking.start, booking.timeZone)
      }
      state={{
        kind: 'ready',
        empty: (
          <BookingEmptyState
            icon={<Calendar aria-hidden="true" />}
            title={t('calendar.noEvents')}
            description={t('bookings.list.emptyBody')}
          />
        ),
      }}
    />
  );
}
