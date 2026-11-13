import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { loadAdoptServices } from '../../loaders/load-services-administration';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { AdoptServiceScreen } from './adopt-service-screen';

import type { RawSearchParams } from '../../loaders/booking-readers';

export interface AdoptServiceAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  readonly searchParams: RawSearchParams;
}

/** Taking a service over from another location: pick it, then say how it is taken. */
export async function AdoptServiceAdministration({
  locale,
  websiteId,
  locationId,
  searchParams,
}: AdoptServiceAdministrationProps) {
  const [t, { filters, page }] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadAdoptServices({ websiteId, locationId, searchParams, queries: getBookingQueries() }),
  ]);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      scope={{ area: 'services', locationId, locationName: page.location.name }}
      crumbs={[{ label: t('services.adopt.title') }]}
      title={t('services.adopt.title')}
      description={t('services.adopt.subtitle', { location: page.location.name })}
    >
      <AdoptServiceScreen
        locale={locale}
        websiteId={websiteId}
        page={page}
        view={{
          search: filters.search,
          source: filters.source,
          service: filters.service,
          from: filters.from,
          pageSize: page.pageSize,
        }}
      />
    </BookingAdminPage>
  );
}
