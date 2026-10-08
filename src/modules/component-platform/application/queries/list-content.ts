import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { clamp, isDefined, trimToNull } from '@lib/utils';

import { getContentDefinition } from '../../domain/content/content-definitions';
import { selectContent } from '../../domain/content/select-content';
import { contentDatasetNotFound } from '../../domain/errors/component-platform-errors';
import { parseDatasetId, parseWebsiteId } from '../../domain/models/ids';
import {
  DEFAULT_CONTENT_LIST_LIMIT,
  MAX_CONTENT_LIST_LIMIT,
  MIN_CONTENT_LIST_LIMIT,
} from '../list-limits';

import type { ContentKind, ContentOf } from '../../domain/content/content-definitions';
import type { PublicComponentPlatformDependencies } from '../component-platform-dependencies';
import type {
  ContentListRequest,
  ContentListView,
  ContentLoadError,
  ContentOrigin,
} from '../contracts/content-views';

function resolveLimit(requested: number | undefined): number {
  const wanted =
    isDefined(requested) && Number.isInteger(requested) ? requested : DEFAULT_CONTENT_LIST_LIMIT;
  return clamp(wanted, MIN_CONTENT_LIST_LIMIT, MAX_CONTENT_LIST_LIMIT);
}

/**
 * Lists the records a content component shows. Always bounded.
 *
 * What a failing or missing source means depends on who is looking:
 *  - published: nothing bound is an empty list, a failing source is an
 *    error. Sample data would put invented events in front of citizens.
 *  - draft: both fall back to labelled sample data, so an editor can lay a
 *    page out before the municipality's API is mapped. The fallback names
 *    its cause instead of hiding it.
 *
 * @authorization public Renders content for pages anyone may read; datasets are read through data-sources within the rendering website.
 */
export class ListContent {
  constructor(private readonly deps: PublicComponentPlatformDependencies) {}

  execute<K extends ContentKind>(
    request: ContentListRequest<K>,
  ): AppResultAsync<ContentListView<K>, ContentLoadError> {
    const { live, clock } = this.deps;
    const parsedWebsite = parseWebsiteId(request.websiteId);
    if (parsedWebsite.isErr()) {
      return errAsync(parsedWebsite.error);
    }

    // Canonical instants compare chronologically as text, which is how content is selected.
    const now = clock.now().toISOString();
    const category = trimToNull(request.category);
    const limit = resolveLimit(request.limit);
    const isDraft = request.mode === 'draft';

    const present = (
      records: ReadonlyArray<ContentOf<K>>,
      origin: ContentOrigin,
    ): ContentListView<K> => ({
      ...selectContent(request.kind, records, { now, category, limit }),
      origin,
    });
    const sampled = (cause: string | null): ContentListView<K> =>
      present(getContentDefinition(request.kind).sample(now), {
        kind: 'sample',
        cause,
      });
    const fallback = (
      error: ContentLoadError,
    ): AppResultAsync<ContentListView<K>, ContentLoadError> =>
      isDraft ? okAsync(sampled(error.code)) : errAsync(error);

    const rawDatasetId = trimToNull(request.datasetId);
    if (rawDatasetId === null) {
      return okAsync(isDraft ? sampled(null) : present([], { kind: 'unbound' }));
    }

    // A malformed id is "not found", like an unknown one: a visitor learns nothing about which ids exist.
    const parsedDataset = parseDatasetId(rawDatasetId);
    if (parsedDataset.isErr()) {
      return fallback(contentDatasetNotFound());
    }

    return live
      .list({
        kind: request.kind,
        datasetId: parsedDataset.value,
        websiteId: parsedWebsite.value,
      })
      .map((batch) => present(batch.items, { kind: 'live' }))
      .orElse(fallback);
  }
}
