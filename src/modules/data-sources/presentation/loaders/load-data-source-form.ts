import { notFound } from 'next/navigation';

import { orNotFound } from '@lib/errors/or-not-found';

import { toRestSourceForm } from '../schemas/rest-source-config-schema';

import type { DataSourceReaders } from '../../application/contracts/screen-views';

interface DataSourceFormTarget {
  readonly websiteId: string;
  readonly sourceId: string;
}

/**
 * A stored source as its edit form starts: the route's website must own it, and only a REST
 * source has a connection to edit. The values carry no credential and no hidden URL query.
 */
export async function loadDataSourceForm(
  target: DataSourceFormTarget,
  queries: Pick<DataSourceReaders, 'getDataSourceSettings'>,
) {
  const settings = await orNotFound(queries.getDataSourceSettings.execute(target.sourceId));
  if (settings.websiteId !== target.websiteId || settings.kind !== 'REST') {
    notFound();
  }
  return {
    id: settings.id,
    name: settings.name,
    values: toRestSourceForm(settings),
    hasHiddenUrlParts: settings.connection?.hasHiddenUrlParts ?? false,
  };
}
