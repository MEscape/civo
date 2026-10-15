import { cache } from 'react';

import { getMemberTenantIds } from '@modules/auth';
import { websiteQueries } from '@modules/website';

import { orNull } from './or-fail';

/** How many websites the switcher lists: a platform administrator may have many, and the list is a menu, not a directory. */
const SWITCHER_LIMIT = 48;

export interface SwitchableWebsites {
  readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  /** More websites exist than the menu lists; the full list is one choice away. */
  readonly isTruncated: boolean;
}

/**
 * The websites someone can switch to from the website bar, or none when they have
 * only one (there is nothing to switch). A platform administrator gets the most
 * recently changed ones, bounded; everyone else the websites they belong to, from
 * their own memberships. One read per request, shared by whatever asks.
 */
export const loadSwitchableWebsites = cache(
  async (canListAll: boolean): Promise<SwitchableWebsites> => {
    if (canListAll) {
      const page = await orNull(
        websiteQueries.listWebsites.execute({ page: 1, pageSize: SWITCHER_LIMIT }),
      );
      return {
        websites: (page?.items ?? []).map(({ id, name }) => ({ id, name })),
        isTruncated: (page?.total ?? 0) > SWITCHER_LIMIT,
      };
    }
    const tenantIds = await getMemberTenantIds();
    if (tenantIds.length < 2) {
      return { websites: [], isTruncated: false };
    }
    const names = await orNull(websiteQueries.listWebsiteNames.execute(tenantIds));
    return { websites: (names ?? []).map(({ id, name }) => ({ id, name })), isTruncated: false };
  },
);
