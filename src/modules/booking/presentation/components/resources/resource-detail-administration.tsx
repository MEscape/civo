import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { resourceListNavigation } from '../../forms/resource-list-navigation';
import { loadResourceDetail } from '../../loaders/load-resources-administration';
import { bookingRoutes } from '../../routes';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { ResourceBlockDialog } from './resource-block-dialog.client';
import { ResourceOverview } from './resource-overview';

import type { BookingMay, RawSearchParams } from '../../loaders/booking-readers';

export interface ResourceDetailAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  readonly resourceId: string;
  readonly searchParams: RawSearchParams;
  readonly may: BookingMay;
}

/** One resource: how it is used today, its facts, and the ways to change or block it. */
export async function ResourceDetailAdministration({
  locale,
  websiteId,
  locationId,
  resourceId,
  searchParams,
  may,
}: ResourceDetailAdministrationProps) {
  const [t, resource] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadResourceDetail({ websiteId, locationId, resourceId }, getBookingQueries()),
  ]);
  const mayConfigure = may('booking.configure');
  const listOrigin = resourceListNavigation.parse(searchParams['list']);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      scope={{
        area: 'resources',
        locationId,
        locationName: resource.location.name,
        listHref: resourceListNavigation.parent(websiteId, locationId, listOrigin),
      }}
      crumbs={[{ label: resource.name }]}
      title={resource.name}
      description={t('resources.overview.subtitle', { location: resource.location.name })}
      actions={
        mayConfigure ? (
          <>
            <ResourceBlockDialog resource={resource} listOrigin={listOrigin} />
            <Link
              href={resourceListNavigation.withOrigin(
                bookingRoutes.resourceEdit(
                  websiteId,
                  { locationId, resourceId: resource.id },
                  'all',
                ),
                listOrigin,
              )}
              className={buttonVariants()}
            >
              {t('resources.overview.editAll')}
            </Link>
          </>
        ) : undefined
      }
    >
      <ResourceOverview
        locale={locale}
        resource={resource}
        mayConfigure={mayConfigure}
        isSaved={searchParams['saved'] === '1'}
        listOrigin={listOrigin}
      />
    </BookingAdminPage>
  );
}
