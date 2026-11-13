import { I18nProvider } from '@components/providers/i18n-provider';
import { Alert } from '@components/ui/alert';

import { getTranslations } from '@i18n/server';

import { mapTiles } from '@lib/config';

import { getMapQueries } from '../../../composition';
import { loadSavedMap } from '../../loaders/load-saved-map';

import { SavedMapViewer } from './saved-map-viewer.client';

export interface SavedMapTarget {
  readonly websiteId: string;
  readonly mapId: string;
}

/**
 * The editor's view of a saved map: always the draft. A saved map is staged content until a
 * release freezes it, so a published page never reads this table; it draws the frozen copy
 * through the signed inline binding.
 */
export async function SavedMapSection({ websiteId, mapId }: SavedMapTarget) {
  const t = await getTranslations('map');
  const loaded = await loadSavedMap(getMapQueries(), websiteId, mapId);
  if (loaded === null) {
    return (
      <Alert variant="warning" role="status">
        {t('states.unavailable')}
      </Alert>
    );
  }
  const { map, model } = loaded;
  return (
    <I18nProvider namespaces={['map']}>
      <SavedMapViewer
        key={`${websiteId}:${map.id}:${String(map.version)}`}
        map={map}
        model={model}
        tiles={mapTiles()}
      />
    </I18nProvider>
  );
}
