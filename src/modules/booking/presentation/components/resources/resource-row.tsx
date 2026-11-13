import { ChevronRight } from '@components/icons/icons';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { TableRowDetailsTrigger } from '@components/shared/table-row-details';
import { buttonVariants } from '@components/ui/button';

import type { Locale } from '@i18n';
import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { resourceListNavigation } from '../../forms/resource-list-navigation';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { bookingRoutes } from '../../routes';

import { ResourceStatusChip } from './resource-status-chip';
import { ResourceToday } from './resource-today';

import type { ResourceSummaryDto } from '../../dto/resource-dto';
import type { BookingTranslator } from '../../translation/translator';

interface ResourceColumnsInput {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  readonly listOrigin?: string | undefined;
}

/** The columns of a row, shared with the list's header so they line up. */
export async function resourceColumns({
  locale,
  websiteId,
  locationId,
  listOrigin,
}: ResourceColumnsInput): Promise<ReadonlyArray<ResponsiveColumn<ResourceSummaryDto>>> {
  const t = await getTranslations({ locale, namespace: 'booking' });
  return [
    {
      id: 'name',
      label: t('resources.list.columns.name'),
      width: '@3xl:w-1/4',
      cell: (resource) => <TableRowDetailsTrigger label={resource.name} />,
    },
    {
      id: 'type',
      label: t('resources.list.columns.type'),
      cell: (resource) => t(RESOURCE_TYPE_MESSAGE_KEYS[resource.type]),
    },
    {
      id: 'places',
      label: t('resources.list.columns.places'),
      width: '@3xl:w-20',
      cell: (resource) => resource.places,
    },
    {
      id: 'usedBy',
      label: t('resources.list.columns.usedBy'),
      cell: (resource) => t('resources.list.usedByCount', { count: resource.usedBy.length }),
    },
    {
      id: 'status',
      label: t('resources.list.columns.status'),
      cell: (resource) => (
        <ResourceStatusChip
          status={resource.status}
          label={t(`resources.status.${resource.status}`)}
        />
      ),
    },
    {
      id: 'actions',
      label: t('resources.list.open'),
      isAction: true,
      cell: (resource) => (
        <div className="flex justify-end gap-1">
          <Link
            href={resourceListNavigation.withOrigin(
              bookingRoutes.resource(websiteId, locationId, resource.id),
              listOrigin,
            )}
            aria-label={t('resources.list.openNamed', { name: resource.name })}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            {t('resources.list.open')}
            <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          </Link>
        </div>
      ),
    },
  ];
}

/**
 * One resource of the list opens to show how it is used today and by which services. The shared
 * table disclosure opens by keyboard and assistive technology announces its expanded state.
 */
export function ResourceRowDetails({
  locale,
  t,
  resource,
}: {
  readonly locale: Locale;
  readonly t: BookingTranslator;
  readonly resource: ResourceSummaryDto;
}) {
  return (
    <div className="grid gap-6 border-t border-border bg-canvas p-4 md:grid-cols-2">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-copy">{t('resources.today.title')}</h3>
        <ResourceToday locale={locale} t={t} today={resource.today} places={resource.places} />
      </section>
      <section className="space-y-1 text-sm">
        <h3 className="font-semibold text-copy">{t('resources.usedBy.title')}</h3>
        {resource.usedBy.length === 0 ? (
          <p className="text-copy-muted">{t('resources.usedBy.none')}</p>
        ) : (
          <ul>
            {resource.usedBy.map((use) => (
              <li key={use.serviceId}>
                {use.isRequired
                  ? use.serviceName
                  : t('resources.usedBy.optional', { name: use.serviceName })}
              </li>
            ))}
          </ul>
        )}
        {resource.usedBy.length > 1 && (
          <p className="text-copy-muted">{t('resources.usedBy.shared')}</p>
        )}
      </section>
    </div>
  );
}
