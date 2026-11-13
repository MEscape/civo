'use client';

import type { ReactNode } from 'react';

import { ArrowRight } from '@components/icons/icons';
import { ResponsiveTable } from '@components/shared/responsive-table';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { customerNameOf, nameBookOf, staffNamesOf } from '../../forms/booking-names';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { BookingStatusChip } from '../shared/booking-status-chip';

import type { BookingDto, BookingNamesDto } from '../../dto/booking-dto';

export interface BookingRowsProps {
  readonly items: readonly BookingDto[];
  readonly names: BookingNamesDto;
  /** The address that opens each booking's details, by id: the list's filters are kept in it. */
  readonly detailsHref: Readonly<Record<string, string>>;
  readonly selectedId: string | undefined;
  /** The list spans several days: each time says its day too. */
  readonly showsDate: boolean;
  /** Shown when the page holds no booking. */
  readonly empty: ReactNode;
}

/**
 * The bookings of a page as the shared responsive table: rows on a wide container, one card per
 * booking on a narrow one, the same cells and the same details link in both. Every time is on the
 * wall clock of its own location (BD-02). The citizen's name is shown to the people who may read the
 * website's bookings only: this list is theirs, and the use case answers nobody else.
 */
export function BookingRows({
  items,
  names,
  detailsHref,
  selectedId,
  showsDate,
  empty,
}: BookingRowsProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat();
  const book = nameBookOf(names, t('bookings.list.unknown'));
  const whenOf = (booking: BookingDto) =>
    showsDate
      ? format.dateTime(booking.start, booking.timeZone)
      : format.time(booking.start, booking.timeZone);

  const columns: ReadonlyArray<ResponsiveColumn<BookingDto>> = [
    {
      id: 'time',
      label: t('bookings.list.columns.time'),
      width: '@3xl:w-32',
      cell: (booking) => <span className="font-semibold text-copy">{whenOf(booking)}</span>,
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
      id: 'customer',
      label: t('bookings.list.columns.customer'),
      cell: (booking) => (
        <span className="text-copy">{customerNameOf(booking.customer) ?? '–'}</span>
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
      id: 'staff',
      label: t('bookings.list.columns.staff'),
      cell: (booking) => (
        <span className="text-copy-muted">{staffNamesOf(booking, book).join(', ') || '–'}</span>
      ),
    },
    {
      id: 'details',
      label: t('bookings.list.details'),
      isAction: true,
      width: '@3xl:w-32',
      cell: (booking) => (
        <div className="flex justify-end gap-1">
          <Link
            href={detailsHref[booking.id] ?? '#'}
            aria-label={t('bookings.list.detailsFor', {
              service: book.service(booking.serviceId),
              time: whenOf(booking),
            })}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            {t('bookings.list.details')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <ResponsiveTable
      label={t('bookings.list.panelTitle')}
      rows={items}
      rowKey={(booking) => booking.id}
      columns={columns}
      density="standard"
      state={{ kind: 'ready', empty }}
      rowProps={(booking) =>
        booking.id === selectedId ? { 'aria-current': 'true', className: 'bg-canvas' } : {}
      }
    />
  );
}
