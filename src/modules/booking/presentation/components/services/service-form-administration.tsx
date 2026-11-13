import { connection } from 'next/server';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { parseServiceSection, parseServiceStep } from '../../forms/service-form-params';
import { serviceListNavigation } from '../../forms/service-list-navigation';
import { loadServiceForm } from '../../loaders/load-services-administration';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { ServiceForm } from './service-form.client';

import type { RawSearchParams } from '../../loaders/booking-readers';

export interface ServiceFormAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  /** The service being changed; absent: a new one. */
  readonly serviceId?: string | undefined;
  readonly searchParams: RawSearchParams;
}

/** The form that creates a service at a location or changes one, a step or a part at a time. */
export async function ServiceFormAdministration({
  locale,
  websiteId,
  locationId,
  serviceId,
  searchParams,
}: ServiceFormAdministrationProps) {
  // Reading a service reads the clock (bookings still ahead); that needs the request first, or it would be baked into a prerender.
  await connection();
  const [t, { service, options }] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadServiceForm({ websiteId, locationId, serviceId }, getBookingQueries()),
  ]);
  const requested = parseServiceSection(searchParams['section']);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      scope={{
        area: 'services',
        locationId,
        ...(service === null ? {} : { locationName: service.location.name }),
        listHref: serviceListNavigation.parent(
          websiteId,
          locationId,
          serviceListNavigation.parse(searchParams['list']),
        ),
      }}
      crumbs={[{ label: service === null ? t('services.form.createTitle') : service.name }]}
      title={service === null ? t('services.form.createTitle') : service.name}
      description={service === null ? undefined : t('services.form.editTitle')}
      unsavedBody={t('services.form.unsavedBody')}
    >
      {/* A new version remounts the form with the saved values, which is what "reload" asks for. */}
      <ServiceForm
        key={service === null ? 'new' : `${service.version}|${service.settingVersion}`}
        websiteId={websiteId}
        locationId={locationId}
        service={service}
        part={requested === 'all' ? 'wizard' : requested}
        step={parseServiceStep(searchParams['step'])}
        options={options}
        listOrigin={serviceListNavigation.parse(searchParams['list'])}
      />
    </BookingAdminPage>
  );
}
