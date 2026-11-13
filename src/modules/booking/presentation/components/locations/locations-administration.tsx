import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { mapTiles } from '@lib/config';

import { getBookingQueries } from '../../../composition';
import { loadLocationsAdministration } from '../../loaders/load-locations-administration';
import { bookingRoutes } from '../../routes';
import { BookingAdminPage } from '../shared/booking-admin-page';
import { SetupGuide } from '../shared/setup-guide';

import { LocationsList } from './locations-list';

import type { BookingMay, RawSearchParams } from '../../loaders/booking-readers';

export interface LocationsAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly searchParams: RawSearchParams;
  readonly may: BookingMay;
}

/**
 * The locations of the website: the guide through the setup while it is unfinished (a location is
 * the first step, and the services, resources and team belong to one), then the filtered, paged
 * list. Filters live in the address, so a view can be shared and works without script.
 */
export async function LocationsAdministration({
  locale,
  websiteId,
  searchParams,
  may,
}: LocationsAdministrationProps) {
  const [t, { filters, page, setup }] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadLocationsAdministration({ websiteId, searchParams, queries: getBookingQueries() }),
  ]);
  const mayConfigure = may('booking.configure');

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('locations.title')}
      description={t('locations.description')}
      actions={
        mayConfigure ? (
          <Link href={bookingRoutes.locationNew(websiteId)} className={buttonVariants()}>
            {t('locations.create')}
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {mayConfigure && <SetupGuide locale={locale} websiteId={websiteId} setup={setup} />}
        <LocationsList
          locale={locale}
          websiteId={websiteId}
          page={page}
          search={filters.search}
          status={filters.status}
          mayConfigure={mayConfigure}
          tiles={mapTiles()}
        />
      </div>
    </BookingAdminPage>
  );
}
