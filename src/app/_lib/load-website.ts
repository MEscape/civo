import { cache } from 'react';

import { websiteQueries } from '@modules/website';

/** One website read per request, shared by every layout and page that shows it. */
export const loadWebsite = cache((websiteId: string) =>
  websiteQueries.getWebsiteById.execute(websiteId),
);
