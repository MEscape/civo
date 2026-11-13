import { Alert } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { publicEnv } from '@lib/config';

import { getMapQueries } from '../../../composition';
import { CREATED_PARAM, parseMapEditorStep } from '../../forms/map-editor-steps';
import { loadMapEditor, mayChangeMap } from '../../loaders/load-map-editor';
import { mapRoutes } from '../../routes';
import { DeleteMapButton } from '../management/delete-map-button.client';
import { MapReadyNotice } from '../management/map-ready-notice';
import { MapsAdminPage } from '../shared/maps-admin-page';

import { MapEditorForm } from './map-editor-form.client';

import type { DeleteMapAction } from '../../hooks/use-delete-map';
import type { MapUsageReaders } from '../../loaders/load-map-usage';

function mapTiles() {
  const accessToken = publicEnv.NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED
    ? publicEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    : undefined;
  return accessToken === undefined
    ? null
    : { accessToken, styleUrl: publicEnv.NEXT_PUBLIC_MAPBOX_STYLE_URL };
}

interface MapEditorProps {
  readonly builderHref: string;
  readonly websiteId: string;
  readonly mapId?: string | undefined;
  readonly locale: Locale;
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  readonly canEdit: boolean;
  readonly canPublish: boolean;
  /** Which components place the map; `null` when the person may not read pages or releases. */
  readonly usage: MapUsageReaders | null;
  /** Deletes a map no page places: it belongs to the module that sees the pages, so the route hands it in. */
  readonly deleteMap?: { readonly action: DeleteMapAction; readonly inUseCode: string } | undefined;
}

/**
 * One map, new or saved: the same frame as the list, its name as the heading and its removal beside
 * it. A saved map no page places yet says so above the form, with the one button to where it goes.
 */
export async function MapEditor({
  builderHref,
  websiteId,
  mapId,
  locale,
  searchParams,
  canEdit,
  canPublish,
  usage: usageReaders,
  deleteMap,
}: MapEditorProps) {
  const [{ map, datasets, usedOn, awaiting }, t] = await Promise.all([
    loadMapEditor({
      websiteId,
      mapId,
      queries: getMapQueries(),
      locale,
      readers: usageReaders,
    }),
    getTranslations({ locale, namespace: 'map' }),
  ]);
  const mayChange = mayChangeMap(map, { canEdit, canPublish });
  const heading =
    map === null
      ? { title: t('management.create'), description: t('management.createDescription') }
      : { title: map.name, description: t('management.editDescription') };
  return (
    <MapsAdminPage
      locale={locale}
      websiteId={websiteId}
      {...heading}
      crumb={heading.title}
      actions={
        map !== null && mayChange && deleteMap !== undefined ? (
          <DeleteMapButton
            websiteId={websiteId}
            map={{ id: map.id, name: map.name }}
            deleteMap={deleteMap.action}
            inUseCode={deleteMap.inUseCode}
            usedOn={usedOn}
            afterDeleteHref={mapRoutes.list(websiteId)}
          />
        ) : undefined
      }
    >
      <div className="space-y-6">
        {usedOn?.length === 0 && (
          <MapReadyNotice locale={locale} target={awaiting[0]} builderHref={builderHref} />
        )}
        {datasets.isTruncated && (
          <Alert variant="warning" role="status">
            {t('management.datasetsTruncated')}
          </Alert>
        )}
        <MapEditorForm
          websiteId={websiteId}
          initialMap={map}
          step={parseMapEditorStep(searchParams['step'])}
          isCreated={map !== null && searchParams[CREATED_PARAM] === '1'}
          datasets={datasets.items}
          canEdit={mayChange}
          canPublish={canPublish}
          tiles={mapTiles()}
        />
      </div>
    </MapsAdminPage>
  );
}
