import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedPage } from '../load-authorized-page';
import { toEditorSessionView } from '../page-view-mappers';
import { resolveEditorMode } from '../services/resolve-editor-mode';

import type { EditorSessionView } from '../contracts/page-views';
import type { LoadPageError } from '../load-authorized-page';
import type { PageDependencies } from '../page-dependencies';

/**
 * Starts an editing session. Requires `page.update`, not `page.read`: a
 * read-only role must not be handed the editor. The mode and the component
 * catalog are decided here, on the server, so the client never has to be
 * told what it may do by a prop.
 */
export class GetEditorSession {
  constructor(private readonly deps: PageDependencies) {}

  execute(pageId: string): AppResultAsync<EditorSessionView, LoadPageError> {
    return loadAuthorizedPage(this.deps, pageId, 'page.update').map(({ actor, page }) =>
      toEditorSessionView({
        page,
        editorMode: resolveEditorMode(actor),
        catalog: this.deps.components,
      }),
    );
  }
}
