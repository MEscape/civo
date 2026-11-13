import { OverviewTile } from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { orNull } from '@lib/errors/or-null';

import { getMapQueries } from '../../../composition';
import { mapRoutes } from '../../routes';

export interface MapsOverviewTileProps {
  readonly locale: Locale;
  readonly websiteId: string;
}

/** The website's saved maps at a glance for its overview. Nothing for someone who may not read maps. */
export async function MapsOverviewTile({ locale, websiteId }: MapsOverviewTileProps) {
  const [t, format, maps] = await Promise.all([
    getTranslations({ locale, namespace: 'map' }),
    getAppFormatters(),
    orNull(getMapQueries().listSavedMaps.execute(websiteId, { page: 1, pageSize: 1 })),
  ]);
  if (maps === null) {
    return null;
  }

  return (
    <OverviewTile
      label={t('websiteOverview.title')}
      value={format.number(maps.total)}
      hint={maps.total === 0 ? t('websiteOverview.empty') : undefined}
      href={mapRoutes.list(websiteId)}
    />
  );
}
