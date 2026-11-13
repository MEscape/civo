import { OverviewTile } from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { orNull } from '@lib/errors/or-null';

import { getBuilderQueries } from '../../../composition';
import { builderRoutes } from '../../routes';

export interface PagesOverviewTileProps {
  readonly locale: Locale;
  readonly websiteId: string;
}

/** The website's pages at a glance for its overview: how many, and the one changed last. Nothing for someone who may not read pages. */
export async function PagesOverviewTile({ locale, websiteId }: PagesOverviewTileProps) {
  const [t, format, pages] = await Promise.all([
    getTranslations({ locale, namespace: 'builder' }),
    getAppFormatters(),
    orNull(getBuilderQueries().listPages.execute({ websiteId, pageSize: 1 })),
  ]);
  if (pages === null) {
    return null;
  }
  const latest = pages.items[0];

  return (
    <OverviewTile
      label={t('websiteOverview.title')}
      value={format.number(pages.total)}
      detail={latest === undefined ? undefined : `${t('websiteOverview.latest')}: ${latest.title}`}
      hint={latest === undefined ? t('websiteOverview.empty') : undefined}
      href={builderRoutes.pages(websiteId)}
    />
  );
}
