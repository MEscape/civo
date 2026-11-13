import { OverviewTile } from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { orNull } from '@lib/errors/or-null';

import { getDataSourceQueries } from '../../../composition';
import { dataSourceRoutes } from '../../routes';

export interface DataSourcesOverviewTileProps {
  readonly locale: Locale;
  readonly websiteId: string;
}

/** The website's data at a glance for its overview: its sources, and how much of the content they feed is mapped. Nothing for someone who may not read datasets. */
export async function DataSourcesOverviewTile({ locale, websiteId }: DataSourcesOverviewTileProps) {
  const queries = getDataSourceQueries();
  const [t, format, sources, setup] = await Promise.all([
    getTranslations({ locale, namespace: 'dataSources' }),
    getAppFormatters(),
    orNull(queries.listDataSourcesWithDatasets.execute(websiteId, { pageSize: 1 })),
    orNull(queries.getDataSourceSetup.execute(websiteId)),
  ]);
  if (sources === null || setup === null) {
    return null;
  }

  return (
    <OverviewTile
      label={t('websiteOverview.title')}
      value={format.number(sources.total)}
      detail={
        sources.total === 0
          ? undefined
          : `${t('websiteOverview.mapped')}: ${format.number(setup.mappedKinds.length)} / ${format.number(setup.kinds.length)}`
      }
      hint={sources.total === 0 ? t('websiteOverview.empty') : undefined}
      href={dataSourceRoutes.sources(websiteId)}
    />
  );
}
