import { ArrowRight } from '@components/icons/icons';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { dataSourceRoutes } from '../../routes';

import { DataSourceStatusBadge } from './data-source-status-badge';
import { RemoveSourceButton } from './remove-source-button.client';

import type { DataSourceDto } from '../../dto/data-source-dto';
import type { DatasetUsage } from '../../dto/dataset-usage-dto';
import type { AppFormatters, DataSourcesTranslator } from '../../translation/translator';
import type { DeleteDataAction } from '../shared/delete-data';

/** What removing a source from the list needs: which pages use its datasets, and the deletion itself. */
export interface DataSourceRemoval {
  readonly usage: DatasetUsage;
  readonly deleteData: DeleteDataAction;
}

interface DataSourceColumnsInput {
  readonly t: DataSourcesTranslator;
  readonly format: AppFormatters;
  readonly websiteId: string;
  /** Absent when the person may not remove sources. */
  readonly removal?: DataSourceRemoval | undefined;
}

/**
 * The columns of the list of sources: the source with its address, whether it answered, how many
 * datasets it holds and how many still need their fields mapped, when it was last checked, and the
 * way to its page and, for whoever may, removing it, as in the list of maps. Testing and datasets are
 * done on its page.
 */
export function dataSourceColumns({
  t,
  format,
  websiteId,
  removal,
}: DataSourceColumnsInput): ReadonlyArray<ResponsiveColumn<DataSourceDto>> {
  return [
    {
      id: 'source',
      label: t('list.columns.source'),
      cell: (source) => (
        <div className="min-w-0 space-y-1">
          <Link
            href={dataSourceRoutes.source(websiteId, source.id)}
            className="rounded-token-sm font-medium text-primary-copy underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
          >
            {source.name}
          </Link>
          <p className="truncate font-mono text-xs text-copy-muted">
            {source.endpoint ?? t('sourceCard.unknownEndpoint')}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      label: t('list.columns.status'),
      cell: (source) => <DataSourceStatusBadge status={source.status} />,
    },
    {
      id: 'datasets',
      label: t('list.columns.datasets'),
      cell: (source) => {
        const unmapped = source.datasets.filter((dataset) => dataset.mapping === null).length;
        return (
          <div className="space-y-0.5 text-sm">
            <p className="text-copy">{t('list.datasetCount', { count: source.datasets.length })}</p>
            {unmapped > 0 && (
              <p className="text-xs text-copy-muted">
                {t('list.unmappedCount', { count: unmapped })}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'checked',
      label: t('list.columns.checked'),
      cell: (source) =>
        source.lastCheckedAt === null ? (
          <span className="text-sm text-copy-muted">{t('sourceCard.never')}</span>
        ) : (
          <time dateTime={source.lastCheckedAt} className="text-sm text-copy">
            {format.dateTime(source.lastCheckedAt)}
          </time>
        ),
    },
    {
      id: 'actions',
      label: t('list.columns.actions'),
      isAction: true,
      cell: (source) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={dataSourceRoutes.source(websiteId, source.id)}
              aria-label={t('list.open', { name: source.name })}
            >
              {t('list.openLabel')}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
          {removal !== undefined && (
            <RemoveSourceButton
              source={source}
              usage={removal.usage}
              deleteData={removal.deleteData}
              size="sm"
            />
          )}
        </div>
      ),
    },
  ];
}
