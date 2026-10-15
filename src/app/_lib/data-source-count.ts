import { cache } from 'react';

import { dataSourceQueries } from '@modules/data-sources';

/** One read of a website's data sources per request, shared by the blocks of the overview that count them. */
export const loadDataSources = cache((websiteId: string) =>
  dataSourceQueries.listDataSources.execute(websiteId),
);
