import type { ConflictAppError, ForbiddenAppError, ValidationAppError } from '@lib/errors';
import { ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { parsePageVersion } from '../../domain/models/page';
import { parsePageConfig } from '../../domain/models/page-config';
import { checkComposition, checkEditScope } from '../../domain/rules/page-save-checks';
import { countPageNodes } from '../../domain/tree/tree-queries';
import { toSavedRevisionView } from '../builder-view-mappers';
import { BUILDER_RATE_LIMITS } from '../rate-limits';
import { findPage } from '../services/find-page';
import { mayRestructure } from '../services/may-restructure';
import { withinActorLimit } from '../services/within-actor-limit';

import type { Page } from '../../domain/models/page';
import type { PageConfig } from '../../domain/models/page-config';
import type { BuilderAccessError, BuilderScope } from '../../domain/ports/builder-access.port';
import type { SavePageDependencies } from '../builder-dependencies';
import type { SavePageConfigInput } from '../contracts/page-inputs';
import type { SavedRevisionView } from '../contracts/page-views';
import type { FindPageError } from '../services/find-page';
import type { ActorLimitError } from '../services/within-actor-limit';

export type SavePageConfigError =
  BuilderAccessError | FindPageError | ConflictAppError | ActorLimitError;

/** What a save is judged against: the stored page and who is saving it, in which mode. */
interface SaveContext {
  readonly page: Page;
  readonly scope: BuilderScope;
  readonly canRestructure: boolean;
}

interface ValidatedSave {
  readonly config: PageConfig;
  readonly expectedVersion: number;
}

/**
 * Saves the editor's draft as a new revision.
 *
 * What the actor may change is decided HERE, from their permissions in the page's website, and
 * checked against the stored page: hiding a control in the UI is not authorization. A save is
 * refused when it exceeds what the actor may change (and recorded as a security signal), or when
 * someone saved a newer revision since this editor loaded the page (`expectedVersion`). Each
 * editor has a budget of saves, spent after authorization.
 */
export class SavePageConfig {
  constructor(private readonly deps: SavePageDependencies) {}

  execute(input: SavePageConfigInput): AppResultAsync<SavedRevisionView, SavePageConfigError> {
    const { access, pages, audit } = this.deps;

    return access
      .authorizeWebsite('page.update', input.websiteId)
      .andThen(withinActorLimit(this.deps, BUILDER_RATE_LIMITS.savePage))
      .andThen((scope) =>
        findPage(pages, scope, input.pageId).andThen((page) =>
          mayRestructure(access, input.websiteId).andThen((canRestructure) =>
            this.validate(input, { page, scope, canRestructure }).asyncAndThen(
              ({ config, expectedVersion }) =>
                pages
                  .saveConfig({ id: page.id, tenantId: scope.tenantId, config, expectedVersion })
                  .map((revision) => {
                    audit.record({
                      type: 'page.config_saved',
                      actorId: scope.actorId,
                      tenantId: scope.tenantId,
                      pageId: page.id,
                      websiteId: page.websiteId,
                      version: revision.version,
                      nodeCount: countPageNodes(config.children),
                    });
                    return toSavedRevisionView(revision, page);
                  }),
            ),
          ),
        ),
      );
  }

  private validate(
    input: SavePageConfigInput,
    context: SaveContext,
  ): AppResult<ValidatedSave, ValidationAppError | ForbiddenAppError> {
    return parsePageVersion(input.expectedVersion).andThen((expectedVersion) =>
      parsePageConfig(input.config)
        .andThen((config) => this.checkScope(config, context))
        .andThen((config) => this.checkStructure(config, context.canRestructure))
        .map((config) => ({ config, expectedVersion })),
    );
  }

  private checkScope(
    config: PageConfig,
    { page, scope, canRestructure }: SaveContext,
  ): AppResult<PageConfig, ForbiddenAppError> {
    return checkEditScope({
      previous: page.config,
      next: config,
      canRestructure,
      catalog: this.deps.components,
    })
      .map(() => config)
      .mapErr((error) => {
        this.deps.audit.record({
          type: 'page.edit_scope_violation',
          actorId: scope.actorId,
          tenantId: scope.tenantId,
          pageId: page.id,
          errorCode: error.code,
        });
        return error;
      });
  }

  /**
   * Without `page.restructure` the scope check already proved the structure
   * identical to the stored page, so re-validating it could only lock a
   * restricted editor out of a page that still contains a since-removed
   * component. Only editors who can restructure must produce a clean tree.
   */
  private checkStructure(
    config: PageConfig,
    canRestructure: boolean,
  ): AppResult<PageConfig, ValidationAppError> {
    if (!canRestructure) {
      return ok(config);
    }
    return checkComposition(config, this.deps.components).map(() => config);
  }
}
