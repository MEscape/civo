import { cache } from 'react';

import { websiteQueries } from '@modules/website';

import { orFail } from './or-fail';

/**
 * Every website by name for a platform administrator's filter or menu, with
 * whether the list is complete. One read per request, shared by whatever asks.
 */
export const loadWebsiteOptions = cache(async () => {
  const { websites, isTruncated } = await orFail(websiteQueries.listWebsiteOptions.execute());
  return { websites: websites.map(({ id, name }) => ({ id: String(id), name })), isTruncated };
});
