import { orNotFound } from '@lib/errors/or-not-found';
import { resolvePageRequest } from '@lib/pagination';
import { buildQueryString } from '@lib/utils';

import { MAP_LIST_LIMITS } from '../../application/contracts/map-constraints';
import { mapRoutes } from '../routes';

import type { MapListReaders } from '../../application/contracts/map-reader-views';

export async function loadMapsAdministration(
  websiteId: string,
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
  queries: MapListReaders,
) {
  const page = await orNotFound(
    queries.listSavedMaps.execute(websiteId, resolvePageRequest(searchParams, MAP_LIST_LIMITS)),
  );
  return {
    page,
    hrefFor: (target: number) =>
      `${mapRoutes.list(websiteId)}${buildQueryString({
        page: target === 1 ? undefined : target,
        pageSize: page.pageSize === MAP_LIST_LIMITS.defaultPageSize ? undefined : page.pageSize,
      })}`,
  };
}
