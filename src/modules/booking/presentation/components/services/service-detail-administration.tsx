import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { serviceListNavigation } from '../../forms/service-list-navigation';
import { loadServiceDetail } from '../../loaders/load-services-administration';
import { bookingRoutes } from '../../routes';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { ServiceOverview } from './service-overview';
import { ServiceStatusActions } from './service-status-actions.client';

import type { BookingMay, RawSearchParams } from '../../loaders/booking-readers';

export interface ServiceDetailAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  readonly serviceId: string;
  readonly searchParams: RawSearchParams;
  readonly may: BookingMay;
}

/** One service at a location: a row per part, each with its own edit link. */
export async function ServiceDetailAdministration({
  locale,
  websiteId,
  locationId,
  serviceId,
  searchParams,
  may,
}: ServiceDetailAdministrationProps) {
  const [t, service] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadServiceDetail({ websiteId, locationId, serviceId }, getBookingQueries()),
  ]);
  const mayConfigure = may('booking.configure');
  const listOrigin = serviceListNavigation.parse(searchParams['list']);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      scope={{
        area: 'services',
        locationId,
        locationName: service.location.name,
        listHref: serviceListNavigation.parent(websiteId, locationId, listOrigin),
      }}
      crumbs={[{ label: service.name }]}
      title={service.name}
      description={t('services.titleAt', { location: service.location.name })}
      actions={
        mayConfigure ? (
          <>
            <ServiceStatusActions service={service} locationId={locationId} />
            <Link
              href={serviceListNavigation.withOrigin(
                bookingRoutes.serviceEdit(websiteId, { locationId, serviceId: service.id }, 'all'),
                listOrigin,
              )}
              className={buttonVariants()}
            >
              {t('services.overview.editAll')}
            </Link>
          </>
        ) : undefined
      }
    >
      <ServiceOverview
        locale={locale}
        websiteId={websiteId}
        service={service}
        mayConfigure={mayConfigure}
        isSaved={searchParams['saved'] === '1'}
        listOrigin={listOrigin}
      />
    </BookingAdminPage>
  );
}
