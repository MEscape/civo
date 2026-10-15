import { cache } from 'react';

import { releaseQueries } from '@modules/release';

/** One publication status per request, shared by every block of a page that shows part of it. */
export const loadPublicationStatus = cache((websiteId: string) =>
  releaseQueries.getPublicationStatus.execute(websiteId),
);
