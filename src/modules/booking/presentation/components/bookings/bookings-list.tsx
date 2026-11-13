import type { ReactNode } from 'react';

import { Calendar } from '@components/icons/icons';
import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { bookingListHref } from '../../forms/booking-list-href';
import { bookingRoutes } from '../../routes';
import { BookingEmptyState } from '../shared/booking-empty-state';

import { BookingRows } from './booking-rows.client';
import { BookingStateTabs } from './booking-state-tabs';
import { BookingsFilters } from './bookings-filters';

import type { BookingNamesDto, BookingPageDto } from '../../dto/booking-dto';
import type { BookingListView } from '../../forms/booking-list-href';

export interface BookingsListProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly page: BookingPageDto;
  readonly names: BookingNamesDto;
  /** What the address asked for; the days are the ones the list was read for. */
  readonly view: BookingListView;
  /** The details of the booking chosen in the address: a dialog over the list (or the way it was not found). */
  readonly panel?: ReactNode;
}

/**
 * The website's bookings of some days, a page at a time, with the state tabs and their counts and the
 * filters, all in the address so a view can be shared and survives a reload. Choosing a booking keeps
 * every filter and shows its details in the side panel.
 */
export async function BookingsList({
  locale,
  websiteId,
  page,
  names,
  view,
  panel,
}: BookingsListProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const base = bookingRoutes.bookingList(websiteId);
  const shown = {
    ...view,
    from: page.days.from,
    to: page.days.to,
    page: page.page,
    pageSize: page.pageSize,
  };

  return (
    <div className="space-y-4">
      {panel}
      <div className="space-y-4">
        <DataPanel
          title={t('bookings.list.panelTitle')}
          meta={t('bookings.list.summary', { count: page.total })}
          footer={
            page.pageCount > 1 ? (
              <Pagination
                locale={locale}
                slice={page}
                hrefFor={(target) => bookingListHref(base, shown, { page: target })}
                label={t('bookings.list.pagination')}
              />
            ) : undefined
          }
        >
          <BookingsFilters
            locale={locale}
            base={base}
            view={shown}
            names={names}
            states={
              <BookingStateTabs
                locale={locale}
                label={t('bookings.states.label')}
                counts={page.counts}
                active={view.state}
                hrefFor={(state) => bookingListHref(base, shown, { state, bookingId: null })}
              />
            }
          />
          <BookingRows
            items={page.items}
            names={names}
            selectedId={view.bookingId}
            showsDate={page.days.from !== page.days.to}
            detailsHref={Object.fromEntries(
              page.items.map((booking) => [
                booking.id,
                bookingListHref(base, shown, { bookingId: booking.id }),
              ]),
            )}
            empty={
              <BookingEmptyState
                icon={<Calendar aria-hidden="true" />}
                title={t('bookings.list.emptyTitle')}
                description={t('bookings.list.emptyBody')}
              />
            }
          />
        </DataPanel>
      </div>
    </div>
  );
}
