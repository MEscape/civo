import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';
import { buttonVariants } from '@components/ui/button';

import type { Locale } from '@i18n';
import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { bookingRoutes } from '../../routes';
import { LocationCard } from '../locations/location-card';

import type { LocationPageDto } from '../../dto/location-dto';

/** The areas that are looked after one location at a time. */
export type LocationArea = 'services' | 'resources' | 'team';

export interface AreaLocationPickerProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly area: LocationArea;
  readonly page: LocationPageDto;
}

const ROUTES = {
  services: { entry: bookingRoutes.services, ofLocation: bookingRoutes.locationServices },
  resources: { entry: bookingRoutes.resources, ofLocation: bookingRoutes.locationResources },
  team: { entry: bookingRoutes.team, ofLocation: bookingRoutes.locationTeam },
} as const;

/**
 * Services, resources and the team are looked after one location at a time, so their area starts by naming
 * the location: each one is a way to its services or resources. The location is part of the
 * address, not a setting kept somewhere.
 */
export async function AreaLocationPicker({
  locale,
  websiteId,
  area,
  page,
}: AreaLocationPickerProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const routes = ROUTES[area];

  return (
    <DataPanel
      title={t(`${area}.picker.title`)}
      description={t(`${area}.picker.description`)}
      footer={
        page.pageCount > 1 ? (
          <Pagination
            locale={locale}
            slice={page}
            hrefFor={(target) => `${routes.entry(websiteId)}?page=${target}`}
            label={t('locations.pagination')}
          />
        ) : undefined
      }
    >
      <ul className="divide-y divide-border">
        {page.items.map((location) => (
          <li key={location.id} className="flex flex-wrap items-center justify-between gap-2 pe-4">
            <div className="min-w-0 flex-1">
              <LocationCard locale={locale} websiteId={websiteId} location={location} />
            </div>
            <Link
              href={routes.ofLocation(websiteId, location.id)}
              aria-label={t(`${area}.picker.openNamed`, { name: location.name })}
              className={buttonVariants({ variant: 'default', size: 'sm' })}
            >
              {t(`${area}.picker.open`)}
            </Link>
          </li>
        ))}
      </ul>
    </DataPanel>
  );
}
