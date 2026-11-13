import { ChevronRight, Check, Close } from '@components/icons/icons';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { isDefined } from '@lib/utils';

import { locationListNavigation } from '../../forms/location-list-navigation';
import { createZonedFormat } from '../../hooks/use-zoned-format';
import { bookingRoutes } from '../../routes';
import { NameTile } from '../shared/name-tile';
import { StatusChip } from '../shared/status-chip';

import type { LocationSummaryDto } from '../../dto/location-dto';

export interface LocationColumnsInput {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly listOrigin?: string | undefined;
  /** The number of each location on the map beside the list, by id; absent when there is no map. */
  readonly numbers?: Readonly<Record<string, number>> | undefined;
  /** What the last column offers: the location's own page, or the ways on to what belongs to it. */
  readonly actions: 'open' | 'areas';
  readonly mayConfigure: boolean;
}

/** The id of a location's row: the map beside the list finds the row of a pin by it, and the pin of a row. */
export const locationRowId = (id: string) => `location-row-${id}`;

/**
 * The columns every table of locations shares (the list and the overview): the name with its tile and
 * address, whether it is on, and when it is open today on its own clock. A table, so it reads like
 * every other list, and cards where there is no room for columns.
 */
export async function locationColumns({
  locale,
  websiteId,
  listOrigin,
  numbers,
  actions,
  mayConfigure,
}: LocationColumnsInput): Promise<ReadonlyArray<ResponsiveColumn<LocationSummaryDto>>> {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const zoned = createZonedFormat(locale);
  const todayOf = (location: LocationSummaryDto) => {
    if (!location.isActive) {
      return t('locations.today.off');
    }
    const hours = location.todayWindows
      .map(({ start, end }) => zoned.timeRange(start, end, location.timeZone))
      .join(', ');
    return hours === '' ? t('locations.today.closed') : t('locations.today.open', { hours });
  };

  return [
    {
      id: 'name',
      label: t('locations.columns.name'),
      isTitle: true,
      width: '@3xl:w-1/3',
      cell: (location) => (
        <div className="flex items-start gap-3">
          <NameTile
            name={location.name}
            text={numbers?.[location.id] === undefined ? undefined : String(numbers[location.id])}
          />
          <div className="min-w-0">
            <Link
              href={locationListNavigation.withOrigin(
                bookingRoutes.location(websiteId, location.id),
                listOrigin,
              )}
              className="font-semibold text-copy underline-offset-4 hover:underline focus-visible:underline"
            >
              {location.name}
            </Link>
            <p className="text-sm text-copy-muted">
              {[location.address, location.timeZone].filter(isDefined).join(' · ')}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      label: t('locations.columns.status'),
      width: '@3xl:w-1/8',
      cell: (location) =>
        location.isActive ? (
          <StatusChip tone="success" icon={Check}>
            {t('locations.status.active')}
          </StatusChip>
        ) : (
          <StatusChip tone="muted" icon={Close}>
            {t('locations.status.inactive')}
          </StatusChip>
        ),
    },
    {
      id: 'today',
      label: t('locations.columns.today'),
      width: '@3xl:w-1/4',
      cell: todayOf,
    },
    {
      id: 'actions',
      label: t('locations.columns.open'),
      isAction: true,
      cell: (location) =>
        actions === 'open' ? (
          <div className="flex justify-end gap-1">
            <Link
              href={locationListNavigation.withOrigin(
                bookingRoutes.location(websiteId, location.id),
                listOrigin,
              )}
              aria-label={t('locations.openNamed', { name: location.name })}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              {t('locations.open')}
              <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-1">
            {(
              [
                ['services', bookingRoutes.locationServices],
                ['resources', bookingRoutes.locationResources],
                ...(mayConfigure ? ([['team', bookingRoutes.locationTeam]] as const) : []),
              ] as const
            ).map(([area, href]) => (
              <Link
                key={area}
                href={href(websiteId, location.id)}
                aria-label={`${t(`area.${area}`)}: ${location.name}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                {t(`area.${area}`)}
              </Link>
            ))}
          </div>
        ),
    },
  ];
}
