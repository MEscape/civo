import { I18nProvider } from '@components/providers/i18n-provider';
import { Alert } from '@components/ui/alert';

import { getTranslations } from '@i18n/server';

import { mapTiles } from '@lib/config';

import { getMapQueries } from '../../../composition';
import { loadInlineMap } from '../../loaders/load-inline-map';

import { InlineMapViewer } from './inline-map-viewer.client';

import type { SavedMapDraft } from '../../../application/contracts/saved-map-views';

export interface InlineMapTarget {
  readonly websiteId: string;
  readonly mode: 'draft' | 'published';
  readonly draft: SavedMapDraft;
}

/** Only this server-rendered binding can mint a capability. The public action cannot choose website or datasets. */
export async function InlineMapSection(target: InlineMapTarget) {
  const t = await getTranslations('map');
  const loaded = await loadInlineMap(getMapQueries(), target);
  if (loaded === null) {
    return (
      <Alert variant="warning" role="status">
        {t('states.unavailable')}
      </Alert>
    );
  }
  return (
    <I18nProvider namespaces={['map']}>
      <InlineMapViewer
        key={loaded.token}
        token={loaded.token}
        draft={target.draft}
        model={loaded.model}
        tiles={mapTiles()}
      />
    </I18nProvider>
  );
}
