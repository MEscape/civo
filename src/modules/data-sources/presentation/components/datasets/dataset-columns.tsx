import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { Badge } from '@components/ui/badge';

import { Link } from '@i18n';

import { CANONICAL_KIND_MESSAGE_KEYS } from '../../messages/message-keys';
import { dataSourceRoutes } from '../../routes';

import { DatasetRowActions } from './dataset-row-actions.client';
import { DatasetUsedOn } from './dataset-used-on';

import type { DataSourceCapabilities } from '../../dto/data-source-capabilities-dto';
import type { DatasetDto } from '../../dto/dataset-dto';
import type { DatasetUsage } from '../../dto/dataset-usage-dto';
import type { DataSourcesTranslator } from '../../translation/translator';
import type { DeleteDataAction } from '../shared/delete-data';

interface DatasetColumnsInput {
  readonly t: DataSourcesTranslator;
  readonly capabilities: DataSourceCapabilities;
  readonly usage: DatasetUsage;
  readonly deleteData: DeleteDataAction;
}

/**
 * The columns of a source's datasets: the dataset and its type, whether its fields are mapped (an
 * unmapped dataset cannot be used), the pages that show it, and the ways into it.
 */
export function datasetColumns({
  t,
  capabilities,
  usage,
  deleteData,
}: DatasetColumnsInput): ReadonlyArray<ResponsiveColumn<DatasetDto>> {
  return [
    {
      id: 'dataset',
      label: t('datasets.columns.dataset'),
      cell: (dataset) => (
        <div className="min-w-0 space-y-1">
          {capabilities.canMapDataset ? (
            <Link
              href={dataSourceRoutes.datasetMapping(
                dataset.websiteId,
                dataset.sourceId,
                dataset.id,
              )}
              className="rounded-token-sm font-medium text-primary-copy underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
            >
              {dataset.name}
            </Link>
          ) : (
            <p className="font-medium text-copy">{dataset.name}</p>
          )}
          <p className="text-xs text-copy-muted">
            {t('datasets.kind', { kind: t(CANONICAL_KIND_MESSAGE_KEYS[dataset.canonicalKind]) })}
          </p>
        </div>
      ),
    },
    {
      id: 'fields',
      label: t('datasets.columns.fields'),
      cell: (dataset) => (
        <Badge variant={dataset.mapping === null ? 'warning' : 'success'}>
          {dataset.mapping === null ? t('datasets.unmapped') : t('datasets.mapped')}
        </Badge>
      ),
    },
    {
      id: 'usedOn',
      label: t('datasets.columns.usedOn'),
      cell: (dataset) => (
        <DatasetUsedOn t={t} pages={usage === null ? null : (usage[dataset.id] ?? [])} />
      ),
    },
    {
      id: 'actions',
      label: t('datasets.columns.actions'),
      isAction: true,
      // Three labelled actions side by side: mapping, edit, delete.
      width: '@3xl:w-80',
      cell: (dataset) => (
        <DatasetRowActions
          dataset={dataset}
          capabilities={capabilities}
          usedOn={usage === null ? null : (usage[dataset.id] ?? [])}
          deleteData={deleteData}
        />
      ),
    },
  ];
}
