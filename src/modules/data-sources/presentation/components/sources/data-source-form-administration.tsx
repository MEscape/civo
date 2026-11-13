import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getDataSourceQueries } from '../../../composition';
import { parseSourceFormStep } from '../../forms/source-form-steps';
import { loadDataSourceForm } from '../../loaders/load-data-source-form';
import { dataSourceRoutes } from '../../routes';
import { DataSourcesAdminPage } from '../shared/data-sources-admin-page';

import { DataSourceForm } from './data-source-form';

interface DataSourceFormAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** Absent: a new source is connected. */
  readonly sourceId?: string | undefined;
  readonly step: unknown;
}

/** The connect-a-source wizard, and the same wizard prefilled to edit a stored source. */
export async function DataSourceFormAdministration({
  locale,
  websiteId,
  sourceId,
  step,
}: DataSourceFormAdministrationProps) {
  const [t, source] = await Promise.all([
    getTranslations({ locale, namespace: 'dataSources' }),
    sourceId === undefined
      ? undefined
      : loadDataSourceForm({ websiteId, sourceId }, getDataSourceQueries()),
  ]);
  return (
    <DataSourcesAdminPage
      locale={locale}
      websiteId={websiteId}
      title={source ? t('sourceForm.editTitle') : t('panel.createTitle')}
      description={source ? source.name : t('panel.createIntro')}
      crumbs={
        source
          ? [
              { label: source.name, href: dataSourceRoutes.source(websiteId, source.id) },
              { label: t('sourceForm.editTitle') },
            ]
          : [{ label: t('panel.createTitle') }]
      }
    >
      <DataSourceForm websiteId={websiteId} step={parseSourceFormStep(step)} source={source} />
    </DataSourcesAdminPage>
  );
}
