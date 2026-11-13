import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getDataSourceQueries } from '../../../composition';
import { parseMappingFormStep } from '../../forms/mapping-form-steps';
import { loadDatasetForm } from '../../loaders/load-dataset-form';
import { dataSourceRoutes } from '../../routes';
import { DataSourcesAdminPage } from '../shared/data-sources-admin-page';

import { MappingWizard } from './mapping-wizard.client';

interface DatasetMappingAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly sourceId: string;
  readonly datasetId: string;
  readonly step: unknown;
}

/** Loads the exact saved dataset, including one outside the bounded list embedded under a source. */
export async function DatasetMappingAdministration({
  locale,
  step,
  ...target
}: DatasetMappingAdministrationProps) {
  const [t, view] = await Promise.all([
    getTranslations({ locale, namespace: 'dataSources' }),
    loadDatasetForm(target, getDataSourceQueries()),
  ]);
  if (view.dataset === undefined) {
    return null;
  }
  return (
    <DataSourcesAdminPage
      locale={locale}
      websiteId={target.websiteId}
      title={t('mapping.title')}
      description={t('mapping.pageIntro', { dataset: view.dataset.name })}
      crumbs={[
        {
          label: view.source.name,
          href: dataSourceRoutes.source(target.websiteId, target.sourceId),
        },
        { label: view.dataset.name },
      ]}
    >
      <MappingWizard
        websiteId={target.websiteId}
        sourceId={target.sourceId}
        datasetId={view.dataset.id}
        canonicalKind={view.dataset.canonicalKind}
        existingMapping={view.dataset.mapping}
        step={parseMappingFormStep(step)}
      />
    </DataSourcesAdminPage>
  );
}
