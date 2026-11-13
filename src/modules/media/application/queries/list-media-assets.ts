import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { MEDIA_PAGE_LIMITS } from '../media-limits';
import { toMediaAssetView } from '../media-view-mappers';

import type { MediaAccessError } from '../../domain/ports/media-access.port';
import type { ListMediaAssetsOptions, MediaAssetView } from '../contracts/media-views';
import type { MediaDependencies } from '../media-dependencies';

/**
 * One page of the files of the named website, newest first unless a sort is asked for, optionally
 * narrowed to one visibility or a part of the name. Unfinished and vanishing ones are not listed.
 * A page past the end answers the last one.
 */
export class ListMediaAssets {
  constructor(private readonly deps: MediaDependencies) {}

  execute(
    websiteId: string,
    options: ListMediaAssetsOptions = {},
  ): AppResultAsync<Page<MediaAssetView>, MediaAccessError> {
    const requested = resolvePageRequest(options, MEDIA_PAGE_LIMITS);
    const { access, assets, store } = this.deps;

    return access
      .authorizeWebsite('media.read', websiteId)
      .andThen(({ tenantId }) =>
        loadClampedPage(requested, (request) =>
          assets.listReady(tenantId, request, {
            visibility: options.visibility,
            search: options.search,
            sort: options.sort,
          }),
        ),
      )
      .map((found) => ({
        ...found,
        items: found.items.map((asset) => toMediaAssetView(asset, store)),
      }));
  }
}
