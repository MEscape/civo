import { combine, combineAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isPlainObject, trimToNull, unique } from '@lib/utils';

import { getContentDefinition } from '../../domain/content/content-definitions';
import { selectContent } from '../../domain/content/select-content';
import { contentDatasetNotFound } from '../../domain/errors/component-platform-errors';
import { parseDatasetId, parseWebsiteId } from '../../domain/models/ids';
import { resolveListLimit } from '../list-limits';

import type { ContentKind, ContentOf } from '../../domain/content/content-definitions';
import type { ContentBatch } from '../../domain/ports/content-source.port';
import type { PublicComponentPlatformDependencies } from '../component-platform-dependencies';
import type {
  ContentListRequest,
  ContentListView,
  ContentLoadError,
  ContentOrigin,
} from '../contracts/content-views';

/** The primary dataset first, then the further ones; blanks and repeats dropped. */
function distinctDatasetIds(request: {
  readonly datasetId?: string | undefined;
  readonly additionalDatasetIds?: readonly string[] | undefined;
}): readonly string[] {
  const wanted = [request.datasetId, ...(request.additionalDatasetIds ?? [])];
  return unique(
    wanted.flatMap((id) => {
      const trimmed = trimToNull(id);
      return trimmed === null || trimmed === '' ? [] : [trimmed];
    }),
  );
}

function hasStringId(item: unknown): item is { readonly id: string } {
  return isPlainObject(item) && typeof item['id'] === 'string';
}

/**
 * One list from one batch per dataset. Record ids are only unique inside
 * their own dataset, so with several datasets each id is namespaced by its
 * dataset's position; a single dataset keeps its ids untouched.
 */
function mergeBatches<K extends ContentKind>(
  batches: ReadonlyArray<ContentBatch<K>>,
): ReadonlyArray<ContentOf<K>> {
  const [only] = batches;
  if (batches.length === 1 && only !== undefined) {
    return only.items;
  }
  return batches.flatMap((batch, index) =>
    batch.items.map((item) =>
      hasStringId(item) ? { ...item, id: `${String(index)}:${item.id}` } : item,
    ),
  );
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
    const limit = resolveListLimit(request.kind, request.limit);
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

    const rawDatasetIds = distinctDatasetIds(request);
    if (rawDatasetIds.length === 0) {
      return okAsync(isDraft ? sampled(null) : present([], { kind: 'unbound' }));
    }

    // A malformed id is "not found", like an unknown one: a visitor learns nothing about which ids exist.
    const parsedDatasets = combine(rawDatasetIds.map((id) => parseDatasetId(id)));
    if (parsedDatasets.isErr()) {
      return fallback(contentDatasetNotFound());
    }
    const websiteId = parsedWebsite.value;

    // Every dataset must answer: a calendar that silently lacks one district is worse than none.
    return combineAsync(
      parsedDatasets.value.map((datasetId) =>
        live.list({ kind: request.kind, datasetId, websiteId }),
      ),
    )
      .map((batches) => present(mergeBatches(batches), { kind: 'live' }))
      .orElse(fallback);
  }
}
