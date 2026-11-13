import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { serviceListHref } from '../../forms/service-list-href';
import { serviceListNavigation } from '../../forms/service-list-navigation';
import { bookingRoutes } from '../../routes';
import { ListFooter } from '../shared/list-footer';

import { ServiceGroups } from './service-groups.client';
import { ServicesEmpty } from './services-empty';
import { ServicesFilters } from './services-filters';

import type { ServicePageDto } from '../../dto/service-dto';
import type { ServiceListView } from '../../forms/service-list-href';

export interface ServicesListProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly page: ServicePageDto;
  readonly view: ServiceListView;
  /** Whether to offer making one: display only, the use case authorizes on its own. */
  readonly mayConfigure: boolean;
}

/**
 * The services of one location as collapsible categories, filtered and paged by category. The
 * filters are the address, so a view can be shared and survives a reload. It tells apart a location
 * with no service yet from a filter that found none.
 */
export async function ServicesList({
  locale,
  websiteId,
  page,
  view,
  mayConfigure,
}: ServicesListProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const locationId = page.location.id;
  const base = bookingRoutes.locationServices(websiteId, locationId);
  const isFiltered =
    view.search !== undefined ||
    view.category !== undefined ||
    view.origin !== undefined ||
    view.status !== 'active';

  return (
    <div className="space-y-6">
      <DataPanel
        title={t('services.list.panelTitle')}
        meta={t('services.list.summary', {
          categories: page.total,
          services: page.serviceCount,
        })}
        footer={
          <ListFooter
            legend={{ title: t('services.legend.title'), body: t('services.legend.body') }}
          >
            {page.pageCount > 1 && (
              <Pagination
                locale={locale}
                slice={{ ...page, items: page.groups }}
                hrefFor={(target) => serviceListHref(base, view, { page: target })}
                label={t('services.list.pagination')}
              />
            )}
          </ListFooter>
        }
      >
        <ServicesFilters locale={locale} base={base} categories={page.categories} {...view} />
        {page.isTruncated && (
          <p role="status" className="border-b border-border px-4 py-2 text-xs text-copy-muted">
            {t('services.list.truncated')}
          </p>
        )}
        {page.groups.length > 0 ? (
          <ServiceGroups
            websiteId={websiteId}
            locationId={locationId}
            groups={page.groups}
            listOrigin={serviceListNavigation.originOf({ ...view, page: page.page })}
          />
        ) : (
          <ServicesEmpty
            locale={locale}
            websiteId={websiteId}
            locationId={locationId}
            isFiltered={isFiltered}
            mayConfigure={mayConfigure}
          />
        )}
      </DataPanel>
    </div>
  );
}
