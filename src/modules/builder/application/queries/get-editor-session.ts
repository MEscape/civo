import type { AppResultAsync } from '@lib/result';

import { toEditorSessionView } from '../builder-view-mappers';
import { findPage } from '../services/find-page';
import { mayRestructure } from '../services/may-restructure';

import type { BuilderAccessError } from '../../domain/ports/builder-access.port';
import type { BuilderDependencies } from '../builder-dependencies';
import type { EditorSessionView } from '../contracts/page-views';
import type { FindPageError } from '../services/find-page';

/**
 * Starts an editing session. Requires `page.update`, not `page.read`: a
 * read-only role must not be handed the editor. Whether the actor may
 * restructure pages and the component catalog are decided here, on the server, so the client never has to be
 * told what it may do by a prop.
 */
export class GetEditorSession {
  constructor(private readonly deps: BuilderDependencies) {}

  execute(
    websiteId: string,
    pageId: string,
  ): AppResultAsync<EditorSessionView, BuilderAccessError | FindPageError> {
    const { access, pages, components } = this.deps;

    return access
      .authorizeWebsite('page.update', websiteId)
      .andThen((scope) => findPage(pages, scope, pageId))
      .andThen((page) =>
        mayRestructure(access, websiteId).map((canRestructure) =>
          toEditorSessionView({ page, canRestructure, catalog: components }),
        ),
      );
  }
}
