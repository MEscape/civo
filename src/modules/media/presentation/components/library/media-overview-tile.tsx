import { OverviewTile } from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { orNull } from '@lib/errors/or-null';

import { getMediaQueries } from '../../../composition';
import { mediaRoutes } from '../../routes';

export interface MediaOverviewTileProps {
  readonly locale: Locale;
  readonly websiteId: string;
}

/** The website's files at a glance for its overview. Nothing for someone who may not read the library. */
export async function MediaOverviewTile({ locale, websiteId }: MediaOverviewTileProps) {
  const [t, format, files] = await Promise.all([
    getTranslations({ locale, namespace: 'media' }),
    getAppFormatters(),
    orNull(getMediaQueries().listAssets.execute(websiteId, { pageSize: 1 })),
  ]);
  if (files === null) {
    return null;
  }

  return (
    <OverviewTile
      label={t('websiteOverview.title')}
      value={format.number(files.total)}
      hint={files.total === 0 ? t('websiteOverview.empty') : undefined}
      href={mediaRoutes.library(websiteId)}
    />
  );
}
