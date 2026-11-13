import { MapPin } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { getMapQueries } from '../../../composition';
import { loadMapUsage } from '../../loaders/load-map-usage';
import { loadMapsAdministration } from '../../loaders/load-maps-administration';
import { mapRoutes } from '../../routes';
import { MapsAdminPage } from '../shared/maps-admin-page';

import { mapColumns } from './map-columns';
import { MapsGuide } from './maps-guide';

import type { DeleteMapAction } from '../../hooks/use-delete-map';
import type { MapUsageReaders } from '../../loaders/load-map-usage';

interface MapsAdministrationProps {
  readonly builderHref: string;
  readonly websiteId: string;
  readonly locale: Locale;
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  readonly canEdit: boolean;
  /** Withdrawing a public map needs publishing authority, so only then may it be deleted. */
  readonly canPublish: boolean;
  /** Which components place each map; `null` when the person may not read pages or releases. */
  readonly usage: MapUsageReaders | null;
  /** Deletes a map no page places: it belongs to the module that sees the pages. */
  readonly deleteMap: { readonly action: DeleteMapAction; readonly inUseCode: string };
}

/**
 * The website's maps: the guide until a page shows one, then the paged list with where each map
 * is placed. The same frame as the data-source list.
 */
export async function MapsAdministration({
  builderHref,
  websiteId,
  locale,
  searchParams,
  canEdit,
  canPublish,
  usage: usageReaders,
  deleteMap,
}: MapsAdministrationProps) {
  const [{ page, hrefFor }, { usage, awaiting }, t, format] = await Promise.all([
    loadMapsAdministration(websiteId, searchParams, getMapQueries()),
    loadMapUsage(websiteId, locale, usageReaders),
    getTranslations({ locale, namespace: 'map' }),
    getAppFormatters(),
  ]);
  const hasMap = page.total > 0;
  const isPlaced = usage !== null && Object.keys(usage).length > 0;
  const createLink = (
    <Button asChild>
      <Link href={mapRoutes.create(websiteId)}>{t('management.create')}</Link>
    </Button>
  );

  return (
    <MapsAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('management.title')}
      description={t('management.pageDescription')}
      actions={canEdit ? createLink : undefined}
    >
      <div className="space-y-6">
        {/* Unknown usage hides the guide once a map exists, instead of claiming nothing is placed. */}
        {(!hasMap || (usage !== null && !isPlaced)) && (
          <MapsGuide
            locale={locale}
            websiteId={websiteId}
            hasMap={hasMap}
            isPlaced={isPlaced}
            canEdit={canEdit}
            target={awaiting[0]}
            builderHref={builderHref}
          />
        )}
        <DataPanel
          title={t('management.listTitle')}
          description={t('management.listDescription')}
          meta={t('management.count', { count: page.total })}
          footer={
            page.pageCount > 1 ? (
              <Pagination
                locale={locale}
                slice={page}
                label={t('management.pagination')}
                hrefFor={hrefFor}
              />
            ) : undefined
          }
        >
          <ResponsiveTable
            label={t('management.listTitle')}
            rows={page.items}
            rowKey={(map) => map.id}
            density="standard"
            columns={mapColumns({
              t,
              format,
              websiteId,
              usage,
              deleteMap: canEdit ? deleteMap : undefined,
              canPublish,
            })}
            state={{
              kind: 'ready',
              // The guide above offers the first step while the list is empty, so no third call to action here.
              empty: (
                <EmptyState
                  className="py-10"
                  icon={<MapPin className="size-6" aria-hidden="true" />}
                  title={t('management.emptyTitle')}
                  description={t('management.empty')}
                />
              ),
            }}
          />
        </DataPanel>
      </div>
    </MapsAdminPage>
  );
}
