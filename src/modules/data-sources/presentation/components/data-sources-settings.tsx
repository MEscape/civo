import { notFound } from 'next/navigation';

import { ListPagination } from '@components/shared/list-pagination';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildQueryString } from '@lib/utils';

import { dataSourceQueries } from '../../composition';
import { toDataSourceDto } from '../dto/data-source-dto';
import { dataSourceRoutes } from '../routes';

import { DataSourcesPanel } from './data-sources-panel';

import type { ComponentAwaitingData, DatasetUsage } from './dataset-management-item';
import type { DeleteDataAction } from './delete-data-context';

export interface DataSourcesSettingsProps {
  readonly websiteId: string;
  readonly locale: Locale;
  /** The page asked for, straight from the address. */
  readonly page?: unknown;
  readonly pageSize?: unknown;
  /** Which pages use each dataset, read by the route from the builder. */
  readonly usage: DatasetUsage;
  readonly deleteData: DeleteDataAction;
  /** Components still showing sample data, where a dataset goes next. */
  readonly awaiting: readonly ComponentAwaitingData[];
}

/**
 * Server Component: loads one page of sources by calling the query directly
 * (no internal API endpoint) and hands plain DTOs to the client panel.
 * Runs on Node: the module's connectors use `node:dns`.
 */
export async function DataSourcesSettings({
  websiteId,
  locale,
  page,
  pageSize,
  usage,
  deleteData,
  awaiting,
}: DataSourcesSettingsProps) {
  const [result, t] = await Promise.all([
    dataSourceQueries.listDataSourcesWithDatasets.execute(websiteId, { page, pageSize }),
    getTranslations({ locale, namespace: 'dataSources' }),
  ]);

  if (result.isErr()) {
    const { kind } = result.error;
    // Not allowed looks the same to the visitor, on purpose.
    if (kind === 'forbidden' || kind === 'unauthorized') {
      notFound();
    }
    // Anything else is unexpected: let the route's `error.tsx` handle it.
    throw new Error(result.error.code, { cause: result.error });
  }

  const sources = result.value;
  const pagination = sources.pageCount > 1 && (
    <ListPagination
      locale={locale}
      slice={sources}
      hrefFor={(target) =>
        `${dataSourceRoutes.sources(websiteId)}${buildQueryString({
          page: target === 1 ? undefined : target,
          pageSize: sources.pageSize,
        })}`
      }
      label={t('pagination.nav')}
    />
  );

  return (
    <DataSourcesPanel
      websiteId={websiteId}
      sources={sources.items.map(toDataSourceDto)}
      total={sources.total}
      usage={usage}
      deleteData={deleteData}
      awaiting={awaiting}
      pagination={pagination || undefined}
    />
  );
}
