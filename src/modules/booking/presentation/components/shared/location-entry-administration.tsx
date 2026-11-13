import { notFound } from 'next/navigation';

import { MapPin } from '@components/icons/icons';
import { buttonVariants } from '@components/ui/button';

import { Link, redirect } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { loadLocationEntry } from '../../loaders/load-locations-administration';
import { bookingRoutes } from '../../routes';

import { AddAtLocation } from './add-at-location';
import { AreaLocationPicker } from './area-location-picker';
import { BookingAdminPage } from './booking-admin-page';
import { BookingEmptyState } from './booking-empty-state';
import { SetupGuide } from './setup-guide';

import type { LocationArea } from './area-location-picker';
import type { BookingMay, RawSearchParams } from '../../loaders/booking-readers';

export interface LocationEntryAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** The area that is looked after one location at a time. */
  readonly area: LocationArea;
  readonly searchParams: RawSearchParams;
  readonly may: BookingMay;
}

const AREA_PERMISSION = {
  services: 'booking.read',
  resources: 'booking.read',
  team: 'booking.configure',
} as const satisfies Record<LocationArea, 'booking.read' | 'booking.configure'>;

const AREA_ROUTES = {
  services: { ofLocation: bookingRoutes.locationServices, create: bookingRoutes.serviceNew },
  resources: { ofLocation: bookingRoutes.locationResources, create: bookingRoutes.resourceNew },
  team: { ofLocation: bookingRoutes.locationTeam, create: undefined },
} as const;

/** The areas whose things are made at a location right from here; the team is set up from the location's own team page. */
const CREATE_LABEL = { services: 'services.create', resources: 'resources.create' } as const;

/**
 * Where services, resources and the team start: they belong to a location, so the area first says
 * which. It does not leave a first-time manager at a dead end: with no location it leads to making
 * one, with one it goes straight to it, and with several it offers to add right away at any of them,
 * beside the guide through the whole setup.
 */
export async function LocationEntryAdministration({
  locale,
  websiteId,
  area,
  searchParams,
  may,
}: LocationEntryAdministrationProps) {
  if (!may(AREA_PERMISSION[area])) {
    notFound();
  }
  const [t, { page, setup, onlyLocationId }] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadLocationEntry({ websiteId, searchParams, queries: getBookingQueries() }),
  ]);
  const routes = AREA_ROUTES[area];
  if (onlyLocationId !== undefined) {
    // One location: its services, resources or team are the only thing the area could be about.
    return redirect({ href: routes.ofLocation(websiteId, onlyLocationId), locale });
  }
  const mayConfigure = may('booking.configure');

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t(`${area}.title`)}
      description={t(`${area}.picker.description`)}
      actions={
        mayConfigure && routes.create !== undefined && area !== 'team' ? (
          <AddAtLocation
            websiteId={websiteId}
            locations={setup.locationChoices}
            hrefAt={(locationId) => routes.create(websiteId, locationId)}
            label={t(CREATE_LABEL[area])}
            labelAt={(location) => t('setup.addAt', { location })}
            labelWithoutLocation={t('setup.locationFirst')}
          />
        ) : undefined
      }
    >
      <div className="space-y-6">
        {mayConfigure && <SetupGuide locale={locale} websiteId={websiteId} setup={setup} />}
        {page.total === 0 ? (
          <BookingEmptyState
            icon={<MapPin aria-hidden="true" />}
            scope="page"
            title={t('setup.location.title')}
            description={t('setup.location.description')}
            action={
              mayConfigure ? (
                <Link href={bookingRoutes.locationNew(websiteId)} className={buttonVariants()}>
                  {t('setup.location.action')}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <AreaLocationPicker locale={locale} websiteId={websiteId} area={area} page={page} />
        )}
      </div>
    </BookingAdminPage>
  );
}
