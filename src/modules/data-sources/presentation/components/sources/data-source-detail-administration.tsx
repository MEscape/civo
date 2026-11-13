import { Alert } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getDataSourceQueries } from '../../../composition';
import { loadDataSourceDetail } from '../../loaders/load-data-source-detail';
import { loadDatasetUsage } from '../../loaders/load-dataset-usage';
import { dataSourceRoutes } from '../../routes';
import { DataSourcesAdminPage } from '../shared/data-sources-admin-page';

import { connectionNoticeId } from './connection-notice-id';
import { DataSourceDatasets } from './data-source-datasets';
import { RemoveSourceButton } from './remove-source-button.client';
import { SourceConnection } from './source-connection.client';
import { UsageNotice } from './usage-notice';

import type { DataSourceCapabilities } from '../../dto/data-source-capabilities-dto';
import type { DatasetUsageReaders } from '../../loaders/load-dataset-usage';
import type { DeleteDataAction } from '../shared/delete-data';

interface DataSourceDetailAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly sourceId: string;
  readonly readers: DatasetUsageReaders | null;
  readonly capabilities: DataSourceCapabilities;
  readonly deleteData: DeleteDataAction;
}

/**
 * One source: where it reads from and whether it answered, then its datasets. Everything that is
 * done with it starts here, the same shape as a location's overview in booking: heading with its
 * actions, the facts, the lists that belong to it.
 */
export async function DataSourceDetailAdministration({
  locale,
  websiteId,
  sourceId,
  readers,
  capabilities,
  deleteData,
}: DataSourceDetailAdministrationProps) {
  const [t, source, usage] = await Promise.all([
    getTranslations({ locale, namespace: 'dataSources' }),
    loadDataSourceDetail({ websiteId, sourceId, queries: getDataSourceQueries() }),
    loadDatasetUsage(websiteId, locale, readers),
  ]);
  const isReady = source.status === 'OK';

  return (
    <DataSourcesAdminPage
      locale={locale}
      websiteId={websiteId}
      title={source.name}
      description={isReady ? t('sourceDetail.descriptionReady') : t('sourceDetail.description')}
      crumbs={[{ label: source.name }]}
      actions={
        <>
          {capabilities.canCreateDataset &&
            (isReady ? (
              <Button asChild variant={source.datasets.length === 0 ? 'default' : 'outline'}>
                <Link href={dataSourceRoutes.datasetNew(websiteId, source.id)}>
                  {t('datasets.add')}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled aria-describedby={connectionNoticeId(source.id)}>
                {t('datasets.add')}
              </Button>
            ))}
          {capabilities.canDeleteSource && (
            <RemoveSourceButton source={source} usage={usage.usage} deleteData={deleteData} />
          )}
        </>
      }
    >
      <div className="space-y-6">
        <UsageNotice t={t} state={usage.state} />
        <SourceConnection
          source={source}
          mayTest={capabilities.canTestSource}
          editHref={
            capabilities.canUpdateSource && source.kind === 'REST'
              ? dataSourceRoutes.sourceEdit(websiteId, source.id)
              : undefined
          }
        />
        {source.isDatasetListTruncated && (
          <Alert variant="warning" role="status">
            {t('datasets.truncated')}
          </Alert>
        )}
        <DataSourceDatasets
          locale={locale}
          source={source}
          capabilities={capabilities}
          usage={usage.usage}
          deleteData={deleteData}
        />
      </div>
    </DataSourcesAdminPage>
  );
}
