import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { loadServicesAdministration } from '../../loaders/load-services-administration';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { AddServiceMenu } from './add-service-menu.client';
import { ServicesList } from './services-list';

import type { BookingMay, RawSearchParams } from '../../loaders/booking-readers';

export interface ServicesAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  readonly searchParams: RawSearchParams;
  readonly may: BookingMay;
}

/** The services of one location, grouped by category, filtered and paged by the address. */
export async function ServicesAdministration({
  locale,
  websiteId,
  locationId,
  searchParams,
  may,
}: ServicesAdministrationProps) {
  const [t, { filters, page }] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadServicesAdministration({
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
      scope={{ area: 'services', locationId, locationName: page.location.name, isList: true }}
      title={t('services.titleAt', { location: page.location.name })}
      description={t('services.description')}
      actions={
        mayConfigure ? <AddServiceMenu websiteId={websiteId} locationId={locationId} /> : undefined
      }
    >
      <ServicesList
        locale={locale}
        websiteId={websiteId}
        page={page}
        view={{
          search: filters.search,
          category: filters.category,
          origin: filters.origin,
          status: filters.status,
          pageSize: page.pageSize,
        }}
        mayConfigure={mayConfigure}
      />
    </BookingAdminPage>
  );
}
