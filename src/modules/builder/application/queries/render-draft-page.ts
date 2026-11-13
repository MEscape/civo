import type { AppResultAsync } from '@lib/result';

import { parsePageConfig } from '../../domain/models/page-config';
import { BUILDER_RATE_LIMITS } from '../rate-limits';
import { findPageSummary } from '../services/find-page';
import { withinActorLimit } from '../services/within-actor-limit';

import type { BuilderAccessError } from '../../domain/ports/builder-access.port';
import type { RenderDraftPageDependencies } from '../builder-dependencies';
import type { RenderDraftPageInput } from '../contracts/page-inputs';
import type { FindPageSummaryError } from '../services/find-page';
import type { ActorLimitError } from '../services/within-actor-limit';

export type RenderDraftPageError = BuilderAccessError | FindPageSummaryError | ActorLimitError;

/**
 * Renders an unsaved draft for the editor canvas and the component preview.
 *
 * The website whose data the components preview against is read from the
 * STORED page, never from the request. Previously a caller could name any
 * website and have data-aware components render with its data. Unregistered
 * component types are rendered as placeholders, not rejected: a draft may
 * still contain a since-removed component, and the editor must be able to
 * show it so it can be deleted. Only the summary is loaded because this
 * runs on every debounced edit, and each editor has a budget of renders.
 */
export class RenderDraftPage<TOutput> {
  constructor(private readonly deps: RenderDraftPageDependencies<TOutput>) {}

  execute(input: RenderDraftPageInput): AppResultAsync<TOutput, RenderDraftPageError> {
    return this.deps.access
      .authorizeWebsite('page.update', input.websiteId)
      .andThen(withinActorLimit(this.deps, BUILDER_RATE_LIMITS.renderDraft))
      .andThen((scope) => findPageSummary(this.deps.pages, scope, input.pageId))
      .andThen((page) =>
        parsePageConfig(input.config).map((config) =>
          this.deps.renderer.render({
            websiteId: page.websiteId,
            children: config.children,
            isPreview: input.isPreview === true,
          }),
        ),
      );
  }
}
