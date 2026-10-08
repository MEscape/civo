import type { AppResultAsync } from '@lib/result';

import { parsePageConfig } from '../../domain/models/page-config';
import { loadAuthorizedPageSummary } from '../load-authorized-page';

import type { RenderDraftPageInput } from '../contracts/page-views';
import type { LoadPageSummaryError } from '../load-authorized-page';
import type { RenderDraftPageDependencies } from '../page-dependencies';

export type RenderDraftPageError = LoadPageSummaryError;

/**
 * Renders an unsaved draft for the editor canvas and the component preview.
 *
 * The website whose data the components preview against is read from the
 * STORED page, never from the request. Previously a caller could name any
 * website and have data-aware components render with its data. Unregistered
 * component types are rendered as placeholders, not rejected: a draft may
 * still contain a since-removed component, and the editor must be able to
 * show it so it can be deleted. Only the summary is loaded because this
 * runs on every debounced edit.
 */
export class RenderDraftPage<TOutput> {
  constructor(private readonly deps: RenderDraftPageDependencies<TOutput>) {}

  execute(input: RenderDraftPageInput): AppResultAsync<TOutput, RenderDraftPageError> {
    return loadAuthorizedPageSummary(this.deps, input.pageId, 'page.update').andThen(({ page }) =>
      parsePageConfig(input.config).map((config) =>
        this.deps.renderer.render({
          websiteId: page.websiteId,
          children: config.children,
        }),
      ),
    );
  }
}
