import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Badge } from '@components/ui/badge';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { resourceListNavigation } from '../../forms/resource-list-navigation';
import { weekdayId } from '../../forms/week/draft';
import { summarizeWeek } from '../../forms/week/summary';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { bookingRoutes } from '../../routes';
import { SectionOverview } from '../shared/section-overview';

import { ResourceStatusChip } from './resource-status-chip';
import { ResourceToday } from './resource-today';

import type { ResourceDto } from '../../dto/resource-dto';
import type { ResourceSection } from '../../routes';

export interface ResourceOverviewProps {
  readonly locale: Locale;
  readonly resource: ResourceDto;
  /** Whether to offer the edit links: display only, the use case authorizes on its own. */
  readonly mayConfigure: boolean;
  /** Arrived from a save that the server confirmed. */
  readonly isSaved: boolean;
  readonly listOrigin?: string | undefined;
}

/**
 * A resource as the parts it is set up in, each with what is set today worked out from the data and
 * its own way to change it, how it is used today, and the services that use it. Nothing here is
 * typed in by hand, so it cannot disagree with what is stored.
 */
export async function ResourceOverview({
  locale,
  resource,
  mayConfigure,
  isSaved,
  listOrigin,
}: ResourceOverviewProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const edit = (section: ResourceSection) =>
    mayConfigure
      ? {
          label: t('resources.overview.edit'),
          href: resourceListNavigation.withOrigin(
            bookingRoutes.resourceEdit(
              resource.websiteId,
              { locationId: resource.location.id, resourceId: resource.id },
              section,
            ),
            listOrigin,
          ),
        }
      : undefined;
  const ownHours = summarizeWeek(resource.weekly, {
    none: t('overview.hoursNone'),
    day: (index) => t(`weekdays.short.${weekdayId(index)}`),
    range: (from, to) => t('week.range', { from, to }),
    group: (days, hoursText) => t('week.group', { days, hours: hoursText }),
    withBreak: (hoursText, breaks) => t('week.withBreak', { hours: hoursText, breaks }),
    total: (hoursCount, minutes) => t('week.total', { hours: hoursCount, minutes }),
  });
  const blocks = resource.blocks.length;

  return (
    <div className="space-y-6">
      {isSaved && (
        <Alert variant="success" role="status">
          <AlertTitle>{t('resources.overview.savedTitle')}</AlertTitle>
          <AlertDescription>{t('resources.overview.savedBody')}</AlertDescription>
        </Alert>
      )}

      {mayConfigure && <p className="text-sm text-copy-muted">{t('resources.overview.hint')}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <ResourceStatusChip
          status={resource.status}
          label={t(`resources.status.${resource.status}`)}
        />
        <Badge variant="muted">
          {t('resources.overview.todayPeak', {
            peak: resource.today.peak,
            places: resource.places,
          })}
        </Badge>
      </div>

      <SectionOverview
        label={t('resources.overview.sectionsLabel')}
        rows={[
          {
            key: 'basics',
            title: t('resources.overview.rows.basics'),
            summary: [
              t(RESOURCE_TYPE_MESSAGE_KEYS[resource.type]),
              t('resources.overview.places', { count: resource.places }),
              t('resources.overview.setup', { minutes: resource.setupMinutes }),
              t('resources.overview.teardown', { minutes: resource.teardownMinutes }),
            ].join(' · '),
            action: edit('basics'),
          },
          {
            key: 'availability',
            title: t('resources.overview.rows.availability'),
            summary: [
              resource.followsLocation
                ? t('resources.overview.followsLocation')
                : `${t('resources.overview.ownHours')}: ${ownHours.join(', ')}`,
              blocks === 0
                ? t('resources.overview.blocksNone')
                : t('resources.overview.blocksCount', { count: blocks }),
            ].join(' · '),
            action: edit('availability'),
          },
          {
            key: 'usedBy',
            title: t('resources.overview.rows.usedBy'),
            summary:
              resource.usedBy.length === 0
                ? t('resources.usedBy.none')
                : resource.usedBy
                    .map((use) =>
                      use.isRequired
                        ? use.serviceName
                        : t('resources.usedBy.optional', { name: use.serviceName }),
                    )
                    .join(', '),
          },
        ]}
      />

      <section className="space-y-2 rounded-token border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-copy">{t('resources.today.title')}</h2>
        <ResourceToday locale={locale} t={t} today={resource.today} places={resource.places} />
      </section>
    </div>
  );
}
