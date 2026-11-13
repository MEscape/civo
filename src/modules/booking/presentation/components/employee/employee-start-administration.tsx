import { getTranslations } from '@i18n/server';

import { orNotFound } from '@lib/errors/or-not-found';

import { getBookingQueries } from '../../../composition';
import {
  loadDayPlan,
  loadMessages,
  loadOwnPlaces,
  loadPreferences,
} from '../../loaders/load-employee-administration';
import { loadOpenBookings } from '../../loaders/load-open-bookings';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { CoverNotice } from './cover-notice';
import { NoCalendar } from './employee-screen-parts';
import { EmployeeSetupGuide } from './employee-setup-guide';
import { EmployeeStart } from './employee-start';

import type { EmployeeScreenProps } from './employee-screen-parts';

/** How many of the newest unread messages the start page shows. */
const FRESH_MESSAGES = 3;

/**
 * The start of the employee's own area: today's plan, the open bookings and the newest messages, read
 * together (the page has one loading state, shaped like it) and laid out like the workspace overview.
 */
export async function EmployeeStartAdministration({ locale, websiteId, may }: EmployeeScreenProps) {
  const queries = getBookingQueries();
  const mayClaim = may('booking.claim.own');
  const [t, plan, open, inbox, preferences, places] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadDayPlan({ websiteId, searchParams: {}, queries }),
    mayClaim ? orNotFound(loadOpenBookings(queries, websiteId)) : null,
    loadMessages({ websiteId, searchParams: {}, queries }),
    // The preferences order the open bookings: only someone who may take bookings has any to set.
    mayClaim ? loadPreferences(websiteId, queries) : null,
    loadOwnPlaces(websiteId, queries),
  ]);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('employee.start.title')}
      description={t('employee.start.description')}
    >
      {plan.hasCalendar ? (
        <div className="space-y-6">
          {places !== null && (
            <CoverNotice locale={locale} coverage={places.coverage} today={plan.today} />
          )}
          {preferences !== null && (
            <EmployeeSetupGuide locale={locale} websiteId={websiteId} preferences={preferences} />
          )}
          <EmployeeStart
            locale={locale}
            websiteId={websiteId}
            plan={plan}
            open={open}
            unread={inbox.unread}
            fresh={inbox.items.filter((message) => !message.isRead).slice(0, FRESH_MESSAGES)}
          />
        </div>
      ) : (
        <NoCalendar locale={locale} />
      )}
    </BookingAdminPage>
  );
}
