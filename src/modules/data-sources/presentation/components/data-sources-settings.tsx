import { notFound } from 'next/navigation';

import { dataSourceQueries } from '../../composition';
import { toDataSourceDto } from '../dto/data-source-dto';

import { DataSourcesPanel } from './data-sources-panel';

export interface DataSourcesSettingsProps {
  readonly websiteId: string;
}

/**
 * Server Component: loads the settings data by calling the query directly
 * (no internal API endpoint) and hands plain DTOs to the client panel.
 * Runs on Node: the module's connectors use `node:dns`.
 */
export async function DataSourcesSettings({ websiteId }: DataSourcesSettingsProps) {
  const result = await dataSourceQueries.listDataSourcesWithDatasets.execute(websiteId);

  if (result.isErr()) {
    const { kind } = result.error;
    // Not allowed looks the same to the visitor, on purpose.
    if (kind === 'forbidden' || kind === 'unauthorized') {
      notFound();
    }
    // Anything else is unexpected: let the route's `error.tsx` handle it.
    throw new Error(result.error.code, { cause: result.error });
  }

  return <DataSourcesPanel websiteId={websiteId} sources={result.value.map(toDataSourceDto)} />;
}
