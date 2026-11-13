import { Calendar } from '@components/icons/icons';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { loadCalendarAdministration } from '../../loaders/load-bookings-administration';
import { bookingRoutes } from '../../routes';
import { CreateBookingButton } from '../bookings/create-booking-button.client';
import { BookingAdminPage } from '../shared/booking-admin-page';
import { BookingEmptyState } from '../shared/booking-empty-state';

import { CalendarScreen } from './calendar-screen';

import type { BookingMay, RawSearchParams } from '../../loaders/booking-readers';

export interface CalendarAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly searchParams: RawSearchParams;
  readonly may: BookingMay;
}

/** The manager's calendar: the bookings of a day, a week, a month or a list, with the list's filters. */
export async function CalendarAdministration({
  locale,
  websiteId,
  searchParams,
  may,
}: CalendarAdministrationProps) {
  const [t, { filters, names, home, date, calendar }] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadCalendarAdministration({ websiteId, searchParams, queries: getBookingQueries() }),
  ]);
  const mayManage = may('booking.manage');

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('calendar.title')}
      description={t('calendar.description')}
      actions={
        mayManage && home !== undefined ? (
          <CreateBookingButton names={names} listHref={bookingRoutes.bookingList(websiteId)} />
        ) : undefined
      }
    >
      {home === undefined || date === undefined || calendar === null ? (
        <BookingEmptyState
          icon={<Calendar aria-hidden="true" />}
          scope="page"
          title={t('bookings.noLocations.title')}
          description={t('bookings.noLocations.body')}
        />
      ) : (
        <CalendarScreen
          locale={locale}
          websiteId={websiteId}
          names={names}
          today={home.today}
          mayManage={mayManage}
          address={{
            view: filters.view,
            date,
            locationId: filters.locationId,
            state: filters.state,
          }}
          calendar={calendar}
        />
      )}
    </BookingAdminPage>
  );
}
