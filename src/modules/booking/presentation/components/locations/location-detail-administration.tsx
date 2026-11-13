import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { mapTiles } from '@lib/config';

import { getBookingQueries } from '../../../composition';
import { locationListNavigation } from '../../forms/location-list-navigation';
import { notTakenOverCount, NOT_TAKEN_OVER_PARAM } from '../../forms/take-over-param';
import { loadLocationDetail } from '../../loaders/load-locations-administration';
import { bookingRoutes } from '../../routes';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { LocationOverview } from './location-overview';

import type { BookingMay, RawSearchParams } from '../../loaders/booking-readers';

export interface LocationDetailAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  readonly searchParams: RawSearchParams;
  readonly may: BookingMay;
}

/** One location: its overview, with the way to everything that belongs to it (services, resources, team). */
export async function LocationDetailAdministration({
  locale,
  websiteId,
  locationId,
  searchParams,
  may,
}: LocationDetailAdministrationProps) {
  const [t, location] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadLocationDetail({ websiteId, locationId }, getBookingQueries()),
  ]);
  const mayConfigure = may('booking.configure');
  const listOrigin = locationListNavigation.parse(searchParams['list']);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      crumbs={[
        {
          label: t('overview.back'),
          href: locationListNavigation.parent(websiteId, listOrigin),
        },
        { label: location.name },
      ]}
      title={location.name}
      actions={
        <>
          <Link
            href={bookingRoutes.locationServices(websiteId, location.id)}
            className={buttonVariants({ variant: 'outline' })}
          >
            {t('area.services')}
          </Link>
          <Link
            href={bookingRoutes.locationResources(websiteId, location.id)}
            className={buttonVariants({ variant: 'outline' })}
          >
            {t('area.resources')}
          </Link>
          {mayConfigure && (
            <>
              <Link
                href={bookingRoutes.locationTeam(websiteId, location.id)}
                className={buttonVariants({ variant: 'outline' })}
              >
                {t('area.team')}
              </Link>
              <Link
                href={locationListNavigation.withOrigin(
                  bookingRoutes.locationEdit(websiteId, location.id, 'all'),
                  listOrigin,
                )}
                className={buttonVariants()}
              >
                {t('overview.editAll')}
              </Link>
            </>
          )}
        </>
      }
    >
      <LocationOverview
        locale={locale}
        location={location}
        mayConfigure={mayConfigure}
        isSaved={searchParams['saved'] === '1'}
        notTakenOver={notTakenOverCount(searchParams[NOT_TAKEN_OVER_PARAM])}
        listOrigin={listOrigin}
        tiles={mapTiles()}
      />
    </BookingAdminPage>
  );
}
