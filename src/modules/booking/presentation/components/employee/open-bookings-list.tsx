import { Calendar } from '@components/icons/icons';
import { DataPanel } from '@components/shared/data-panel';
import { FilterChips } from '@components/shared/filter-bar';
import { Pagination } from '@components/shared/pagination';
import { ResponsiveTable } from '@components/shared/responsive-table';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { FIT_LEVEL_TABS, openListHref, openListSlice } from '../../forms/open-bookings';
import { bookingRoutes } from '../../routes';
import { BookingEmptyState } from '../shared/booking-empty-state';

import { openBookingColumns } from './open-bookings-columns';
import { OpenBookingsFilters } from './open-bookings-filters';

import type { OpenBookingDto } from '../../dto/booking-dto';
import type { OpenListView } from '../../forms/open-bookings';

export interface OpenBookingsListProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** Filtered by the use case, best fit first. */
  readonly items: readonly OpenBookingDto[];
  readonly view: OpenListView;
  readonly page: unknown;
  readonly locations: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

/**
 * The open bookings the employee could take, in the order of their preferences, in the frame the
 * bookings list has: one panel with the fit chips and the filters in one strip, the table, and a page
 * at a time. Re-read when the tab is shown again, so a booking somebody else took does not linger.
 */
export async function OpenBookingsList({
  locale,
  websiteId,
  items,
  view,
  page,
  locations,
}: OpenBookingsListProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const base = bookingRoutes.meOpen(websiteId);
  const { fit, counts, slice } = openListSlice(items, view, page);
  const columns = await openBookingColumns(locale, bookingRoutes.mePlan(websiteId));

  return (
    <DataPanel
      title={t('employee.open.panelTitle')}
      meta={t('employee.open.summary', { count: slice.total })}
      footer={
        slice.pageCount > 1 ? (
          <Pagination
            locale={locale}
            slice={slice}
            hrefFor={(target) => openListHref(base, view, { page: target })}
            label={t('employee.open.pagination')}
          />
        ) : undefined
      }
    >
      <OpenBookingsFilters
        locale={locale}
        base={base}
        view={view}
        locations={locations}
        fits={
          <FilterChips
            label={t('employee.open.tabs.label')}
            chips={FIT_LEVEL_TABS.map((key) => ({
              key,
              isActive: fit === key,
              label: t(`employee.open.tabs.${key}`, { count: counts[key] }),
              href: openListHref(base, view, { fit: key }),
            }))}
          />
        }
      />
      <ResponsiveTable
        label={t('employee.open.panelTitle')}
        rows={slice.items}
        rowKey={({ booking }) => booking.id}
        columns={columns}
        density="standard"
        state={{
          kind: 'ready',
          empty: (
            <BookingEmptyState
              icon={<Calendar aria-hidden="true" />}
              title={t('employee.open.empty.title')}
              description={t('employee.open.empty.description')}
            />
          ),
        }}
      />
    </DataPanel>
  );
}
