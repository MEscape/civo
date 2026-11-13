import { Check, Close } from '@components/icons/icons';
import type { PointMapTiles } from '@components/shared/point-map';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Badge } from '@components/ui/badge';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { countsOf } from '../../forms/exceptions';
import { locationListNavigation } from '../../forms/location-list-navigation';
import { weekdayId } from '../../forms/week/draft';
import { summarizeWeek } from '../../forms/week/summary';
import { bookingRoutes } from '../../routes';
import { SectionOverview } from '../shared/section-overview';
import { StatusChip } from '../shared/status-chip';

import { LocationOverviewMap } from './location-overview-map.client';

import type { LocationDto } from '../../dto/location-dto';
import type { LocationSection } from '../../routes';

export interface LocationOverviewProps {
  readonly locale: Locale;
  readonly location: LocationDto;
  /** Whether to offer the edit links: display only, the use case authorizes on its own. */
  readonly mayConfigure: boolean;
  /** Arrived from a save that the server confirmed. */
  readonly isSaved: boolean;
  /** How many of the services chosen in the wizard could not be taken over (the location itself was saved). */
  readonly notTakenOver?: number;
  readonly listOrigin?: string | undefined;
  /** The map provider's settings; without them the overview has no map. */
  readonly tiles: PointMapTiles | null;
}

/**
 * A location as the parts it is set up in, each with what is set today worked out from the data and
 * its own way to change it: nobody has to walk through the other parts. Nothing here is typed in by
 * hand, so it cannot disagree with the hours it summarizes.
 */
export async function LocationOverview({
  locale,
  location,
  mayConfigure,
  isSaved,
  notTakenOver = 0,
  listOrigin,
  tiles,
}: LocationOverviewProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const counts = countsOf(location.exceptions);
  const edit = (section: LocationSection) =>
    mayConfigure
      ? {
          label: t('overview.edit'),
          href: locationListNavigation.withOrigin(
            bookingRoutes.locationEdit(location.websiteId, location.id, section),
            listOrigin,
          ),
        }
      : undefined;

  const hours = summarizeWeek(location.weekly, {
    none: t('overview.hoursNone'),
    day: (index) => t(`weekdays.short.${weekdayId(index)}`),
    range: (from, to) => t('week.range', { from, to }),
    group: (days, hoursText) => t('week.group', { days, hours: hoursText }),
    withBreak: (hoursText, breaks) => t('week.withBreak', { hours: hoursText, breaks }),
    total: (hoursCount, minutes) => t('week.total', { hours: hoursCount, minutes }),
  });

  return (
    <div className="space-y-6">
      {isSaved && (
        <Alert variant="success" role="status">
          <AlertTitle>{t('overview.savedTitle')}</AlertTitle>
          <AlertDescription>{t('overview.savedBody')}</AlertDescription>
        </Alert>
      )}

      {notTakenOver > 0 && (
        <Alert variant="warning" role="status">
          <AlertTitle>{t('overview.takeOverTitle', { count: notTakenOver })}</AlertTitle>
          <AlertDescription>
            {t('overview.takeOverBody')}{' '}
            <Link
              href={bookingRoutes.serviceAdopt(location.websiteId, location.id)}
              className="font-medium underline underline-offset-4"
            >
              {t('overview.takeOverAction')}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {location.isActive ? (
          <StatusChip tone="success" icon={Check}>
            {t('locations.status.active')}
          </StatusChip>
        ) : (
          <StatusChip tone="muted" icon={Close}>
            {t('locations.status.inactive')}
          </StatusChip>
        )}
        <Badge variant="muted">
          {t('overview.futureBookings', { count: location.futureBookingCount })}
        </Badge>
      </div>

      {mayConfigure && <p className="text-sm text-copy-muted">{t('overview.hint')}</p>}

      <div
        className={
          tiles === null ? undefined : 'grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
        }
      >
        <SectionOverview
          label={t('overview.sectionsLabel')}
          rows={[
            {
              key: 'basics',
              title: t('overview.rows.basics'),
              summary: [location.address ?? t('overview.noAddress'), location.timeZone].join(' · '),
              action: edit('basics'),
            },
            {
              key: 'hours',
              title: t('overview.rows.hours'),
              summary: hours.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              )),
              action: edit('hours'),
            },
            {
              key: 'exceptions',
              title: t('overview.rows.exceptions'),
              summary:
                counts.all === 0
                  ? t('overview.exceptionsNone')
                  : t('overview.exceptionsSummary', {
                      count: counts.all,
                      holidays: counts.holidays,
                      special: counts.special,
                      closures: counts.closures,
                    }),
              action: edit('exceptions'),
            },
          ].map((row, index) => ({ ...row, title: `${String(index + 1)} · ${row.title}` }))}
        />
        {tiles !== null && (
          <LocationOverviewMap
            tiles={tiles}
            id={location.id}
            name={location.name}
            address={location.address}
          />
        )}
      </div>
    </div>
  );
}
