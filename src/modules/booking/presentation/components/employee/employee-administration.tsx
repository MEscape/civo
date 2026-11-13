import { Alert, AlertDescription } from '@components/ui/alert';

import { getTranslations } from '@i18n/server';

import { unique } from '@lib/utils';

import { getBookingQueries } from '../../../composition';
import { locationsOf } from '../../forms/open-bookings';
import {
  loadDayPlan,
  loadMessages,
  loadOpenAdministration,
  loadOwnPlaces,
  loadPreferences,
} from '../../loaders/load-employee-administration';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { CoverNotice } from './cover-notice';
import { DayPlan } from './day-plan';
import { NoCalendar } from './employee-screen-parts';
import { MessagesList } from './messages-list';
import { OpenBookingsList } from './open-bookings-list';
import { PreferencesForm } from './preferences-form.client';

import type { EmployeeScreenProps } from './employee-screen-parts';
import type { RawSearchParams } from '../../loaders/booking-readers';

interface EmployeeScreenWithQueryProps extends EmployeeScreenProps {
  readonly searchParams: RawSearchParams;
}

/** One day of the employee's plan. */
export async function DayPlanAdministration({
  locale,
  websiteId,
  searchParams,
  may,
}: EmployeeScreenWithQueryProps) {
  const queries = getBookingQueries();
  const [t, plan, places] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadDayPlan({ websiteId, searchParams, queries }),
    loadOwnPlaces(websiteId, queries),
  ]);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('employee.plan.title')}
      description={t('employee.plan.description')}
    >
      {plan.hasCalendar ? (
        <div className="space-y-6">
          {places !== null && (
            <CoverNotice locale={locale} coverage={places.coverage} today={plan.today} />
          )}
          <DayPlan
            locale={locale}
            websiteId={websiteId}
            plan={plan}
            mayHandBack={may('booking.claim.own')}
          />
        </div>
      ) : (
        <NoCalendar locale={locale} />
      )}
    </BookingAdminPage>
  );
}

/** The open bookings the employee could take, narrowed by the address. */
export async function OpenBookingsAdministration({
  locale,
  websiteId,
  searchParams,
}: EmployeeScreenWithQueryProps) {
  const queries = getBookingQueries();
  const [t, { view, all, filtered }, places] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadOpenAdministration({ websiteId, searchParams, queries }),
    loadOwnPlaces(websiteId, queries),
  ]);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('employee.open.title')}
      description={t('employee.open.description')}
    >
      <div className="space-y-6">
        <Alert variant="info">
          <AlertDescription>
            {t('employee.open.hint')}
            {places !== null && (
              <>
                {' '}
                {t('employee.open.places', {
                  home: places.location.name,
                  others: places.coverage.length,
                  list: unique(places.coverage.map(({ locationName }) => locationName)).join(', '),
                })}
              </>
            )}
          </AlertDescription>
        </Alert>
        <OpenBookingsList
          locale={locale}
          websiteId={websiteId}
          items={filtered}
          view={view}
          page={view.page}
          locations={locationsOf(all)}
        />
      </div>
    </BookingAdminPage>
  );
}

/** The employee's inbox, a page at a time. What a manager changed on their calendar is a message in it like any other. */
export async function MessagesAdministration({
  locale,
  websiteId,
  searchParams,
}: EmployeeScreenWithQueryProps) {
  const [t, page] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadMessages({ websiteId, searchParams, queries: getBookingQueries() }),
  ]);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('employee.messages.title')}
      description={t('employee.messages.description')}
    >
      <MessagesList locale={locale} websiteId={websiteId} page={page} />
    </BookingAdminPage>
  );
}

/** What the employee would like to do: it orders the open bookings, it never adds or removes any. */
export async function PreferencesAdministration({ locale, websiteId }: EmployeeScreenProps) {
  const [t, view] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadPreferences(websiteId, getBookingQueries()),
  ]);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('employee.preferences.title')}
      description={t('employee.preferences.description')}
    >
      {view.hasCalendar ? (
        <div className="space-y-6">
          <Alert variant="info">
            <AlertDescription>{t('employee.preferences.hint')}</AlertDescription>
          </Alert>
          <PreferencesForm view={view} />
        </div>
      ) : (
        <NoCalendar locale={locale} />
      )}
    </BookingAdminPage>
  );
}
