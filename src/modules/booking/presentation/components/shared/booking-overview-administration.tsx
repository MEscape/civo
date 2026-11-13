import { MapPin } from '@components/icons/icons';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { loadBookingOverview } from '../../loaders/load-overview-administration';
import { bookingRoutes } from '../../routes';
import { CreateBookingButton } from '../bookings/create-booking-button.client';

import { BookingAdminPage } from './booking-admin-page';
import { OverviewLocations } from './overview-locations';
import { BookingOverviewTiles } from './overview-tiles';
import { OverviewToday } from './overview-today';
import { OverviewWeek } from './overview-week';
import { SetupGuide } from './setup-guide';

import type { BookingMay } from '../../loaders/booking-readers';

interface BookingOverviewAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly may: BookingMay;
}

/**
 * The workspace's first screen: the guide through the setup while it is unfinished, then what is on
 * (figures, today's bookings, the week ahead as a chart, the locations with their hours). It is the
 * same page before the first location, with empty states in place of the content, so it only fills
 * in as the setup does and nothing jumps when it is finished.
 */
export async function BookingOverviewAdministration({
  locale,
  websiteId,
  may,
}: BookingOverviewAdministrationProps) {
  const [t, { setup, names, today, week, day, locations }] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadBookingOverview({ websiteId, queries: getBookingQueries() }),
  ]);
  const mayConfigure = may('booking.configure');
  const isReady = setup.locations > 0;
  const action =
    isReady && may('booking.manage') ? (
      <CreateBookingButton names={names} listHref={bookingRoutes.bookingList(websiteId)} />
    ) : (
      <Link href={bookingRoutes.locationNew(websiteId)} className={buttonVariants()}>
        <MapPin aria-hidden="true" />
        {t('locations.create')}
      </Link>
    );

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('workspace.overview')}
      description={t('workspace.description')}
      actions={isReady || mayConfigure ? action : undefined}
    >
      {mayConfigure && <SetupGuide locale={locale} websiteId={websiteId} setup={setup} />}
      <BookingOverviewTiles locale={locale} websiteId={websiteId} today={today} setup={setup} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <OverviewToday locale={locale} websiteId={websiteId} page={today} names={names} />
        <OverviewWeek
          locale={locale}
          websiteId={websiteId}
          from={day ?? null}
          items={week?.items ?? null}
        />
      </div>
      {locations !== null && (
        <OverviewLocations
          locale={locale}
          websiteId={websiteId}
          page={locations}
          mayConfigure={mayConfigure}
        />
      )}
    </BookingAdminPage>
  );
}
