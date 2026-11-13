import { Alert } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getDataSourceQueries } from '../../../composition';
import { buildSetupGuide } from '../../forms/setup-guide';
import { loadDataSourcesAdministration } from '../../loaders/load-data-sources-administration';
import { loadDatasetUsage } from '../../loaders/load-dataset-usage';
import { dataSourceRoutes } from '../../routes';
import { DataSourcesGuide } from '../setup/data-sources-guide';
import { ReadyForUseNotice } from '../setup/ready-for-use-notice';
import { DataSourcesAdminPage } from '../shared/data-sources-admin-page';

import { DataSourcesList } from './data-sources-list';
import { UsageNotice } from './usage-notice';

import type { DataSourceCapabilities } from '../../dto/data-source-capabilities-dto';
import type { DatasetUsageReaders } from '../../loaders/load-dataset-usage';
import type { DeleteDataAction } from '../shared/delete-data';

interface DataSourcesAdministrationProps {
  readonly websiteId: string;
  readonly locale: Locale;
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  readonly readers: DatasetUsageReaders | null;
  readonly capabilities: DataSourceCapabilities;
  readonly deleteData: DeleteDataAction;
}

/**
 * The connected sources: the guide through the setup while it is unfinished (a source is the first
 * step, a dataset and its mapping follow on the source's own page), then the paged list. The same
 * frame as the booking lists: heading with its main action, guide, list.
 */
export async function DataSourcesAdministration({
  websiteId,
  locale,
  searchParams,
  readers,
  capabilities,
  deleteData,
}: DataSourcesAdministrationProps) {
  const [t, usage, view] = await Promise.all([
    getTranslations({ locale, namespace: 'dataSources' }),
    loadDatasetUsage(websiteId, locale, readers),
    loadDataSourcesAdministration({
      websiteId,
      page: searchParams['page'],
      pageSize: searchParams['pageSize'],
      queries: getDataSourceQueries(),
    }),
  ]);
  const guide = buildSetupGuide({
    websiteId,
    sources: view.items,
    total: view.sources.total,
    setup: view.setup,
    usage: usage.usage,
    awaiting: usage.awaiting,
  });

  return (
    <DataSourcesAdminPage
      locale={locale}
      websiteId={websiteId}
      title={t('panel.title')}
      description={t('panel.intro')}
      actions={
        capabilities.canCreateSource ? (
          <Button asChild>
            <Link href={dataSourceRoutes.sourceNew(websiteId)}>{t('panel.newSource')}</Link>
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <UsageNotice t={t} state={usage.state} />
        {view.setup.isTruncated && (
          <Alert variant="warning" role="status">
            {t('guide.truncated')}
          </Alert>
        )}
        {guide.isOnlyUseLeft && <ReadyForUseNotice websiteId={websiteId} target={guide.target} />}
        {guide.showsGuide && <DataSourcesGuide steps={guide.steps} />}
        <DataSourcesList
          locale={locale}
          websiteId={websiteId}
          sources={view.items}
          total={view.sources.total}
          // The guide right above already leads to the first source; the empty list does not repeat it.
          mayCreate={capabilities.canCreateSource && !guide.showsGuide}
          slice={view.sources}
          hrefFor={view.hrefFor}
          removal={capabilities.canDeleteSource ? { usage: usage.usage, deleteData } : undefined}
        />
      </div>
    </DataSourcesAdminPage>
  );
}
