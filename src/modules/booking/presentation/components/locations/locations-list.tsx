import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';
import type { PointMapTiles } from '@components/shared/point-map';
import { ResponsiveTable } from '@components/shared/responsive-table';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { offsetOf } from '@lib/pagination';

import { locationListHref } from '../../forms/location-list-href';
import { locationListNavigation } from '../../forms/location-list-navigation';
import { bookingRoutes } from '../../routes';
import { ListFooter } from '../shared/list-footer';

import { locationColumns, locationRowId } from './location-columns';
import { LocationsEmpty } from './locations-empty';
import { LocationsFilters } from './locations-filters';
import { LocationFocusProvider, LocationFocusScope } from './locations-focus.client';
import { LocationsMapEmpty } from './locations-map-empty';
import { LocationsMap } from './locations-map.client';

import type { LocationPageDto } from '../../dto/location-dto';
import type { LocationStatusFilter } from '../../schemas/parse-location-list-input';

export interface LocationsListProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly page: LocationPageDto;
  readonly search: string | undefined;
  readonly status: LocationStatusFilter;
  /** Whether to offer creating one: display only, the use case authorizes on its own. */
  readonly mayConfigure: boolean;
  /** The map provider's settings; without them the list stands alone. */
  readonly tiles: PointMapTiles | null;
}

/** What marks the row of the location in focus (on the map or under the pointer): its tint and a bar at the edge. */
const FOCUSED_ROW =
  'transition-colors motion-reduce:transition-none data-[focused=true]:bg-primary/5 data-[focused=true]:shadow-[inset_3px_0_0_0_var(--color-primary)]';

/**
 * The locations of a website as a filtered, paged table, with the map beside it (a placeholder while
 * there is nothing to pin, so the page keeps its shape). The filter is the address (a search word, a
 * status tab, a page), so a view can be shared and survives a reload. It tells apart a website with
 * no location yet from a search that found none.
 */
export async function LocationsList({
  locale,
  websiteId,
  page,
  search,
  status,
  mayConfigure,
  tiles,
}: LocationsListProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const base = bookingRoutes.locations(websiteId);
  const view = { search, status, pageSize: page.pageSize };

  const firstNumber = offsetOf(page) + 1;
  const columns = await locationColumns({
    locale,
    websiteId,
    listOrigin: locationListNavigation.originOf({ ...view, page: page.page }),
    numbers:
      tiles === null
        ? undefined
        : Object.fromEntries(
            page.items.map((location, index) => [location.id, firstNumber + index]),
          ),
    actions: 'open',
    mayConfigure,
  });

  return (
    <LocationFocusProvider>
      <div
        className={
          tiles === null ? undefined : 'grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'
        }
      >
        <DataPanel
          title={t('locations.panelTitle')}
          meta={t('locations.count', { count: page.total })}
          footer={
            <ListFooter
              legend={{ title: t('locations.legend.title'), body: t('locations.legend.body') }}
            >
              {page.pageCount > 1 && (
                <Pagination
                  locale={locale}
                  slice={page}
                  hrefFor={(target) => locationListHref(base, view, { page: target })}
                  label={t('locations.pagination')}
                />
              )}
            </ListFooter>
          }
        >
          <LocationsFilters locale={locale} base={base} {...view} />
          <LocationFocusScope>
            <ResponsiveTable
              label={t('locations.panelTitle')}
              rows={page.items}
              rowKey={(location) => location.id}
              columns={columns}
              density="standard"
              rowProps={(location) => ({
                id: locationRowId(location.id),
                className: FOCUSED_ROW,
              })}
              state={{
                kind: 'ready',
                empty: (
                  <LocationsEmpty
                    locale={locale}
                    websiteId={websiteId}
                    isFiltered={search !== undefined || status !== 'all'}
                    mayConfigure={mayConfigure}
                  />
                ),
              }}
            />
          </LocationFocusScope>
        </DataPanel>
        {tiles !== null && (
          // As tall as the table beside it (one row, one height), never shorter than a map is useful; a list
          // taller than the window keeps the map in view, under the two bars, as the page scrolls.
          <div className="min-h-80">
            <div className="h-80 lg:sticky lg:top-sticky-panel lg:h-full lg:max-h-[calc(100dvh-var(--spacing-sticky-panel)-1.5rem)] lg:min-h-96">
              {page.items.length > 0 ? (
                <LocationsMap
                  tiles={tiles}
                  locations={page.items.map((location, index) => ({
                    id: location.id,
                    number: firstNumber + index,
                    name: location.name,
                    address: location.address,
                    isActive: location.isActive,
                  }))}
                />
              ) : (
                <LocationsMapEmpty locale={locale} />
              )}
            </div>
          </div>
        )}
      </div>
    </LocationFocusProvider>
  );
}
