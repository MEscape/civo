import { Alert } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getDataSourceQueries } from '../../../composition';
import { parseDatasetFormStep } from '../../forms/dataset-form-steps';
import { loadDatasetForm } from '../../loaders/load-dataset-form';
import { dataSourceRoutes } from '../../routes';
import { DataSourcesAdminPage } from '../shared/data-sources-admin-page';

import { DatasetForm } from './dataset-form';

interface DatasetFormAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly sourceId: string;
  readonly datasetId?: string | undefined;
  readonly step: unknown;
}

export async function DatasetFormAdministration({
  locale,
  websiteId,
  sourceId,
  datasetId,
  step,
}: DatasetFormAdministrationProps) {
  const [t, view] = await Promise.all([
    getTranslations({ locale, namespace: 'dataSources' }),
    loadDatasetForm({ websiteId, sourceId, datasetId }, getDataSourceQueries()),
  ]);
  return (
    <DataSourcesAdminPage
      locale={locale}
      websiteId={websiteId}
      title={view.dataset === undefined ? t('datasetForm.title') : t('datasetForm.titleEdit')}
      description={view.source.name}
      crumbs={[
        { label: view.source.name, href: dataSourceRoutes.source(websiteId, sourceId) },
        { label: view.dataset === undefined ? t('datasetForm.title') : view.dataset.name },
      ]}
    >
      {view.dataset === undefined && view.source.status !== 'OK' ? (
        <div className="space-y-4">
          <Alert variant="warning">{t('datasetForm.testFirst')}</Alert>
          <Button variant="outline" asChild>
            <Link href={dataSourceRoutes.source(websiteId, sourceId)}>{t('sourceCard.test')}</Link>
          </Button>
        </div>
      ) : (
        <DatasetForm
          websiteId={websiteId}
          dataSourceId={sourceId}
          dataset={view.dataset}
          step={parseDatasetFormStep(step)}
        />
      )}
    </DataSourcesAdminPage>
  );
}
