import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';
import { ResponsiveTable } from '@components/shared/responsive-table';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { resourceListHref } from '../../forms/resource-list-href';
import { resourceListNavigation } from '../../forms/resource-list-navigation';
import { bookingRoutes } from '../../routes';

import { resourceColumns, ResourceRowDetails } from './resource-row';
import { ResourcesEmpty } from './resources-empty';
import { ResourcesFilters } from './resources-filters';

import type { ResourcePageDto } from '../../dto/resource-dto';
import type { ResourceListView } from '../../forms/resource-list-href';

export interface ResourcesListProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly page: ResourcePageDto;
  readonly view: ResourceListView;
  /** Whether to offer adding one: display only, the use case authorizes on its own. */
  readonly mayConfigure: boolean;
}

/**
 * The rooms, desks and devices of one location, a page at a time, each opening to show how it is
 * used today and by which services. The filters are the address, so a view can be shared and
 * survives a reload; it tells a location with no resource apart from a filter that found none.
 */
export async function ResourcesList({
  locale,
  websiteId,
  page,
  view,
  mayConfigure,
}: ResourcesListProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const locationId = page.location.id;
  const base = bookingRoutes.locationResources(websiteId, locationId);
  const empty = await ResourcesEmpty({
    locale,
    websiteId,
    locationId,
    isFiltered: view.search !== undefined || view.type !== undefined,
    mayConfigure,
  });
  const columns = await resourceColumns({
    locale,
    websiteId,
    locationId,
    listOrigin: resourceListNavigation.originOf({ ...view, page: page.page }),
  });

  return (
    <DataPanel
      title={t('resources.list.panelTitle')}
      meta={t('resources.list.summary', { count: page.total })}
      footer={
        page.pageCount > 1 ? (
          <Pagination
            locale={locale}
            slice={page}
            hrefFor={(target) => resourceListHref(base, view, { page: target })}
            label={t('resources.list.pagination')}
          />
        ) : undefined
      }
    >
      <ResourcesFilters locale={locale} base={base} {...view} />
      <ResponsiveTable
        label={t('resources.list.panelTitle')}
        rows={page.items}
        rowKey={(resource) => resource.id}
        columns={columns}
        density="standard"
        rowDetails={(resource) => <ResourceRowDetails locale={locale} t={t} resource={resource} />}
        state={{
          kind: 'ready',
          empty,
        }}
      />
    </DataPanel>
  );
}
