import { connection } from 'next/server';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { mapTiles } from '@lib/config';

import { getBookingQueries } from '../../../composition';
import {
  holidayYears,
  parseLocationSection,
  parseWizardStep,
} from '../../forms/location-form-params';
import { listTimeZones } from '../../forms/location-form-values';
import { locationListNavigation } from '../../forms/location-list-navigation';
import {
  loadLocationDetail,
  loadOfferableServices,
} from '../../loaders/load-locations-administration';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { LocationForm } from './location-form.client';

import type { RawSearchParams } from '../../loaders/booking-readers';

export interface LocationFormAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** The location being changed; absent: a new one. */
  readonly locationId?: string | undefined;
  readonly searchParams: RawSearchParams;
}

/** The form that creates a location or changes one, a step or a part at a time. */
export async function LocationFormAdministration({
  locale,
  websiteId,
  locationId,
  searchParams,
}: LocationFormAdministrationProps) {
  // Reading the clock (the year here, the opening state in the loader) needs the request first, or it would be baked into a prerender.
  await connection();
  const t = await getTranslations({ locale, namespace: 'booking' });
  const location =
    locationId === undefined
      ? null
      : await loadLocationDetail({ websiteId, locationId }, getBookingQueries());
  const offered =
    location === null ? await loadOfferableServices({ websiteId }, getBookingQueries()) : [];
  const requested = parseLocationSection(searchParams['section']);
  const years = holidayYears(new Date().getUTCFullYear());

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      crumbs={[
        {
          label: t('overview.back'),
          href: locationListNavigation.parent(
            websiteId,
            locationListNavigation.parse(searchParams['list']),
          ),
        },
        { label: location === null ? t('form.createTitle') : location.name },
      ]}
      title={location === null ? t('form.createTitle') : location.name}
      description={location === null ? undefined : t('form.editTitle')}
      unsavedBody={t('form.unsavedBody')}
    >
      {/* A new version remounts the form with the saved values, which is what "reload" asks for. */}
      <LocationForm
        key={location?.version}
        websiteId={websiteId}
        location={location}
        section={requested === 'all' ? 'wizard' : requested}
        step={parseWizardStep(searchParams['step'])}
        listOrigin={locationListNavigation.parse(searchParams['list'])}
        timeZones={listTimeZones(location?.timeZone ?? 'Europe/Berlin')}
        years={years}
        offered={offered}
        tiles={mapTiles()}
      />
    </BookingAdminPage>
  );
}
