'use client';

import { useTranslations } from '@i18n/client';

/**
 * Which background every map of this installation draws on. It is not a per-map choice: operations
 * switch street tiles on for the whole installation, so the editor states it instead of offering it.
 */
export function MapBackgroundNote({ hasStreetTiles }: { readonly hasStreetTiles: boolean }) {
  const t = useTranslations('map');
  return (
    <dl className="space-y-1 rounded-token border border-border bg-canvas p-4 text-sm">
      <dt className="text-copy-muted">{t('management.background')}</dt>
      <dd className="font-medium text-copy">
        {t(hasStreetTiles ? 'management.backgroundStreets' : 'management.backgroundVector')}
      </dd>
      <dd className="text-copy-muted">
        {t(hasStreetTiles ? 'management.backgroundStreetsHint' : 'management.backgroundVectorHint')}
      </dd>
      <dd className="text-xs text-copy-muted">{t('management.backgroundSetting')}</dd>
    </dl>
  );
}
