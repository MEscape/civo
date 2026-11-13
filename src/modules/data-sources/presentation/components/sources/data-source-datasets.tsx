import { UploadCloud } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { dataSourceRoutes } from '../../routes';
import { datasetColumns } from '../datasets/dataset-columns';

import type { DataSourceCapabilities } from '../../dto/data-source-capabilities-dto';
import type { DataSourceDto } from '../../dto/data-source-dto';
import type { DatasetUsage } from '../../dto/dataset-usage-dto';
import type { DeleteDataAction } from '../shared/delete-data';

interface DataSourceDatasetsProps {
  readonly locale: Locale;
  readonly source: DataSourceDto;
  readonly capabilities: DataSourceCapabilities;
  readonly usage: DatasetUsage;
  readonly deleteData: DeleteDataAction;
}

/**
 * The datasets of one source in the shared responsive table. A dataset is added once the source
 * answered; until then the empty state says why instead of offering a button that cannot work.
 */
export async function DataSourceDatasets({
  locale,
  source,
  capabilities,
  usage,
  deleteData,
}: DataSourceDatasetsProps) {
  const t = await getTranslations({ locale, namespace: 'dataSources' });
  const isReady = source.status === 'OK';
  const canAdd = capabilities.canCreateDataset && isReady;
  const addLink = (
    <Button asChild>
      <Link href={dataSourceRoutes.datasetNew(source.websiteId, source.id)}>
        {t('datasets.add')}
      </Link>
    </Button>
  );

  return (
    <DataPanel
      title={t('datasets.title')}
      description={t('datasets.description')}
      meta={t('datasets.count', { count: source.datasets.length })}
    >
      <ResponsiveTable
        label={t('datasets.title')}
        rows={source.datasets}
        rowKey={(dataset) => dataset.id}
        density="standard"
        columns={datasetColumns({ t, capabilities, usage, deleteData })}
        state={{
          kind: 'ready',
          empty: (
            <EmptyState
              className="py-10"
              icon={<UploadCloud className="size-6" aria-hidden="true" />}
              title={isReady ? t('datasets.firstTitle') : t('datasets.waitingTitle')}
              description={isReady ? t('datasets.firstDescription') : t('datasets.testFirst')}
              action={canAdd ? addLink : undefined}
            />
          ),
        }}
      />
    </DataPanel>
  );
}
