import { Check, Close } from '@components/icons/icons';

import type { Locale } from '@i18n';
import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { isDefined } from '@lib/utils';

import { locationListNavigation } from '../../forms/location-list-navigation';
import { createZonedFormat } from '../../hooks/use-zoned-format';
import { bookingRoutes } from '../../routes';
import { NameTile } from '../shared/name-tile';
import { StatusChip } from '../shared/status-chip';

import type { LocationSummaryDto } from '../../dto/location-dto';

export interface LocationCardProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly location: LocationSummaryDto;
  readonly listOrigin?: string | undefined;
  /** Its number on the map beside the list; absent when there is no map. */
  readonly number?: number | undefined;
}

/**
 * One location of the list: its name (the way to its overview), where it is, whether it is on and
 * when it is open today on its own clock. A card, not a table row, so it reads the same on a phone; the list around it makes it a row.
 */
export async function LocationCard({
  locale,
  websiteId,
  location,
  listOrigin,
  number,
}: LocationCardProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const zoned = createZonedFormat(locale);
  const hours = location.todayWindows
    .map(({ start, end }) => zoned.timeRange(start, end, location.timeZone))
    .join(', ');

  let today = t('locations.today.off');
  if (location.isActive) {
    today = hours === '' ? t('locations.today.closed') : t('locations.today.open', { hours });
  }

  return (
    <div className="flex items-start gap-3 p-4">
      <NameTile name={location.name} text={number === undefined ? undefined : String(number)} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold text-copy">
            <Link
              href={locationListNavigation.withOrigin(
                bookingRoutes.location(websiteId, location.id),
                listOrigin,
              )}
              className="underline-offset-4 hover:underline focus-visible:underline"
            >
              {location.name}
            </Link>
          </h3>
          {location.isActive ? (
            <StatusChip tone="success" icon={Check}>
              {t('locations.status.active')}
            </StatusChip>
          ) : (
            <StatusChip tone="muted" icon={Close}>
              {t('locations.status.inactive')}
            </StatusChip>
          )}
        </div>
        <p className="text-sm text-copy-muted">
          {[location.address, location.timeZone].filter(isDefined).join(' · ')}
        </p>
        <p className="text-sm text-copy">{today}</p>
      </div>
    </div>
  );
}
