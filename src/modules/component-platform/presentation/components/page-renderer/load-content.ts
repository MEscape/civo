import { connection } from 'next/server';

import { escalate } from '@lib/errors';
import type { AppResult, AppResultAsync } from '@lib/result';

import type { ContentKind } from '../../../application/contracts/component-platform-constraints';
import type {
  ContentListRequest,
  ContentListView,
  ContentLoadError,
} from '../../../application/contracts/content-views';

/** What a data component calls to get its records. */
export type LoadContent = <K extends ContentKind>(
  request: ContentListRequest<K>,
) => Promise<AppResult<ContentListView<K>, ContentLoadError>>;

/** The query a loader is built from; the module's `listContent` use case satisfies it. */
export interface ListContentQuery {
  execute<K extends ContentKind>(
    request: ContentListRequest<K>,
  ): AppResultAsync<ContentListView<K>, ContentLoadError>;
}

/**
 * Builds the loader the page renderer hands to data components. It is
 * injected from `composition.ts`, so presentation never reaches the
 * composition root itself.
 *
 * `connection()` opts the render out of prerendering: "upcoming" depends on
 * the current time, and a prerendered page would freeze it at build time.
 * The raw API responses are still cached by the data-sources module.
 *
 * Source failures are already logged by the adapter that translated them.
 * A rejected request (a malformed website id) is a bug upstream: it is
 * logged once and handed to the component's error boundary.
 */
export function createContentLoader(query: ListContentQuery): LoadContent {
  return async (request) => {
    await connection();
    const result = await query.execute(request);
    if (result.isErr() && result.error.kind === 'validation') {
      escalate(result.error);
    }
    return result;
  };
}
