import { Calendar } from '@components/icons/icons';
import { Alert, AlertDescription } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { bookingListHref } from '../../forms/booking-list-href';
import { loadBookingsAdministration } from '../../loaders/load-bookings-administration';
import { bookingRoutes } from '../../routes';
import { BookingAdminPage } from '../shared/booking-admin-page';
import { BookingEmptyState } from '../shared/booking-empty-state';

import { BookingPanel } from './booking-panel.client';
import { BookingsList } from './bookings-list';
import { CreateBookingButton } from './create-booking-button.client';

import type { BookingMay, RawSearchParams } from '../../loaders/booking-readers';

export interface BookingsAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly searchParams: RawSearchParams;
  readonly may: BookingMay;
}

/**
 * The website's bookings as a list with filters and a side panel for the one chosen, all in the
 * address. Another website's booking, or one that is gone, reads "not found" in the panel like the
 * use case says.
 */
export async function BookingsAdministration({
  locale,
  websiteId,
  searchParams,
  may,
}: BookingsAdministrationProps) {
  const [t, { filters, names, page, selected }] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadBookingsAdministration({ websiteId, searchParams, queries: getBookingQueries() }),
  ]);
  const mayManage = may('booking.manage');
  const base = bookingRoutes.bookingList(websiteId);
  const view = { ...filters, ...page.days, page: page.page, pageSize: page.pageSize };
  const panel =
    selected?.isOk() === true ? (
      <BookingPanel
        booking={selected.value}
        names={names}
        mayManage={mayManage}
        closeHref={bookingListHref(base, view, { bookingId: null })}
      />
    ) : (
      selected !== null && (
        <Alert variant="warning" role="status">
          <AlertDescription>{t('bookings.panel.notFound')}</AlertDescription>
        </Alert>
      )
    );

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('bookings.title')}
      description={t('bookings.description')}
      actions={
        mayManage && names.locations.length > 0 ? (
          <CreateBookingButton names={names} listHref={base} />
        ) : undefined
      }
    >
      {names.locations.length === 0 ? (
        <BookingEmptyState
          icon={<Calendar aria-hidden="true" />}
          scope="page"
          title={t('bookings.noLocations.title')}
          description={t('bookings.noLocations.body')}
        />
      ) : (
        <BookingsList
          locale={locale}
          websiteId={websiteId}
          page={page}
          names={names}
          view={view}
          panel={panel}
        />
      )}
    </BookingAdminPage>
  );
}
