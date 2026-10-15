import type { Actor } from '@modules/auth';

import type { ConflictAppError, ForbiddenAppError, ValidationAppError } from '@lib/errors';
import { ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { parsePageVersion } from '../../domain/models/page';
import { parsePageConfig } from '../../domain/models/page-config';
import { checkComposition, checkEditScope } from '../../domain/rules/page-save-checks';
import { countPageNodes } from '../../domain/tree/tree-operations';
import { loadAuthorizedPage } from '../load-authorized-page';
import { toSavedRevisionView } from '../page-view-mappers';
import { mayRestructure } from '../services/may-restructure';

import type { Page } from '../../domain/models/page';
import type { PageConfig } from '../../domain/models/page-config';
import type { SavePageConfigInput, SavedRevisionView } from '../contracts/page-views';
import type { LoadPageError } from '../load-authorized-page';
import type { PageDependencies } from '../page-dependencies';

export type SavePageConfigError = LoadPageError | ConflictAppError;

/** What a save is judged against: the stored page and who is saving it, in which mode. */
interface SaveContext {
  readonly page: Page;
  readonly actor: Actor;
  readonly canRestructure: boolean;
}

interface ValidatedSave {
  readonly config: PageConfig;
  readonly expectedVersion: number;
}

/**
 * Saves the editor's draft as a new revision.
 *
 * What the actor may change is decided HERE, from their permissions, and
 * checked against the stored page: hiding a control in the UI is not
 * authorization. A save is refused when it exceeds what the actor may change
 * (and recorded as a security signal), or when someone saved a newer
 * revision since this editor loaded the page (`expectedVersion`).
 */
export class SavePageConfig {
  constructor(private readonly deps: PageDependencies) {}

  execute(input: SavePageConfigInput): AppResultAsync<SavedRevisionView, SavePageConfigError> {
    const { pages, audit } = this.deps;

    return loadAuthorizedPage(this.deps, input.pageId, 'page.update').andThen(({ actor, page }) =>
      this.validate(input, {
        page,
        actor,
        canRestructure: mayRestructure(actor),
      }).asyncAndThen(({ config, expectedVersion }) =>
        pages
          .saveConfig({
            id: page.id,
            tenantId: actor.tenantId,
            config,
            expectedVersion,
          })
          .map((revision) => {
            audit.record({
              type: 'page.config_saved',
              actorId: actor.id,
              tenantId: actor.tenantId,
              pageId: page.id,
              websiteId: page.websiteId,
              version: revision.version,
              nodeCount: countPageNodes(config.children),
            });
            return toSavedRevisionView(revision, page);
          }),
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
    { page, actor, canRestructure }: SaveContext,
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
          actorId: actor.id,
          tenantId: actor.tenantId,
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
