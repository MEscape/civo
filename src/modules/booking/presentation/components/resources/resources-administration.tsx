import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { loadResourcesAdministration } from '../../loaders/load-resources-administration';
import { bookingRoutes } from '../../routes';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { ResourcesList } from './resources-list';

import type { BookingMay, RawSearchParams } from '../../loaders/booking-readers';

export interface ResourcesAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  readonly searchParams: RawSearchParams;
  readonly may: BookingMay;
}

/** The rooms, desks and devices of one location, filtered and paged by the address. */
export async function ResourcesAdministration({
  locale,
  websiteId,
  locationId,
  searchParams,
  may,
}: ResourcesAdministrationProps) {
  const [t, { filters, page }] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadResourcesAdministration({
      websiteId,
      locationId,
      searchParams,
      queries: getBookingQueries(),
    }),
  ]);
  const mayConfigure = may('booking.configure');

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      scope={{ area: 'resources', locationId, locationName: page.location.name, isList: true }}
      title={t('resources.titleAt', { location: page.location.name })}
      description={t('resources.description')}
      actions={
        mayConfigure ? (
          <Link
            href={bookingRoutes.resourceNew(websiteId, locationId)}
            className={buttonVariants()}
          >
            {t('resources.create')}
          </Link>
        ) : undefined
      }
    >
      <ResourcesList
        locale={locale}
        websiteId={websiteId}
        page={page}
        view={{ search: filters.search, type: filters.type, pageSize: page.pageSize }}
        mayConfigure={mayConfigure}
      />
    </BookingAdminPage>
  );
}
