import type {
  PageConfigView,
  ReleasePageView,
  SavePageConfigInput,
  SavedRevisionView,
} from '@modules/builder';

import type { AppError, ConflictAppError, UnexpectedAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { releaseSnapshotCorrupted, releaseSourceFailed } from '../../domain/errors/release-errors';
import { toPageId } from '../../domain/models/ids';

import type { WebsiteId } from '../../domain/models/ids';
import type { PageDraft } from '../../domain/models/page-draft';
import type { PageTree } from '../../domain/models/page-tree';
import type { PublishablePage } from '../../domain/models/publishable';
import type { SnapshotPage } from '../../domain/models/release-snapshot';
import type {
  PageDraftError,
  PageSource,
  ReplaceChildrenInput,
} from '../../domain/ports/page-source.port';

/**
 * The builder's own failures that mean something to the caller pass
 * through unchanged; any other kind is not something the builder is
 * expected to return here, so it is reported as another module failing,
 * with the original as its cause.
 */
function toDraftError(error: AppError): PageDraftError {
  switch (error.kind) {
    case 'unauthorized':
    case 'forbidden':
    case 'infrastructure':
    case 'unexpected':
      return error;
    default:
      return releaseSourceFailed(error);
  }
}

function toSaveError(error: AppError): ConflictAppError | PageDraftError {
  return error.kind === 'conflict' ? error : toDraftError(error);
}

function toPublishablePage(view: ReleasePageView): PublishablePage {
  const { path, title } = view;
  if (view.status !== 'ready') {
    return { status: view.status, path, title };
  }
  return {
    status: 'ready',
    path,
    title,
    config: view.config,
    componentTypes: view.componentTypes,
  };
}

/**
 * The release module's ONLY dependency on the builder, through the
 * builder's public API. Page storage, the node tree, its validation and its
 * revisions stay behind it: this adapter decides nothing about what a valid
 * tree is (no limits, no node parsing of its own) and writes only through
 * the builder's ordinary save.
 *
 * Public API used from `@modules/builder`, nothing else:
 *  - `listPagesForRelease`: every page with its latest saved config, id and revision
 *  - `restoreStoredPageConfig`: the builder's own reader of a stored config
 *  - `savePageDraft`: the builder's authorized, validated save of a new revision
 */
export class BuilderPageSource implements PageSource {
  constructor(
    private readonly listPagesForRelease: (
      websiteId: string,
    ) => AppResultAsync<readonly ReleasePageView[]>,
    private readonly restorePageConfig: (
      stored: unknown,
    ) => AppResult<PageConfigView, UnexpectedAppError>,
    private readonly savePageDraft: (
      input: SavePageConfigInput,
    ) => AppResultAsync<SavedRevisionView>,
  ) {}

  listForRelease(websiteId: WebsiteId) {
    return this.listPagesForRelease(websiteId)
      .map((views) => views.map(toPublishablePage))
      .mapErr(releaseSourceFailed);
  }

  readTrees(pages: readonly SnapshotPage[]): AppResult<readonly PageTree[], UnexpectedAppError> {
    const trees: PageTree[] = [];

    for (const page of pages) {
      const config = this.restorePageConfig(page.config);
      if (config.isErr()) {
        return err(releaseSnapshotCorrupted(config.error));
      }
      trees.push({ path: page.path, children: config.value.children });
    }
    return ok(trees);
  }

  listDrafts(websiteId: WebsiteId): AppResultAsync<readonly PageDraft[], PageDraftError> {
    return this.listPagesForRelease(websiteId)
      .map((views) => views.map((view) => this.toPageDraft(view)))
      .mapErr(releaseSourceFailed);
  }

  replaceChildren(
    input: ReplaceChildrenInput,
  ): AppResultAsync<void, ConflictAppError | PageDraftError> {
    return this.savePageDraft({
      pageId: input.pageId,
      expectedVersion: input.expectedVersion,
      config: { type: 'page', children: input.children },
    })
      .map(() => undefined)
      .mapErr(toSaveError);
  }

  /** A draft without a readable configuration has no children: it is never overwritten. */
  private toPageDraft(view: ReleasePageView): PageDraft {
    const config = view.status === 'ready' ? this.restorePageConfig(view.config) : null;

    return {
      pageId: toPageId(view.pageId),
      path: view.path,
      version: view.version,
      children: config?.isOk() === true ? config.value.children : null,
    };
  }
}
