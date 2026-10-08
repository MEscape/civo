import { actorHasPermission } from '@modules/auth';
import type { Actor } from '@modules/auth';

import type { EditorMode } from '../../domain/models/editor-capabilities';

/**
 * The editor mode is derived from what the actor may do, never from a
 * route or a request value, so a client cannot claim a wider mode.
 * `page.restructure` unlocks the full builder; without it the session is
 * the restricted municipality editor, which `checkEditScope` enforces on
 * every save.
 */
export function resolveEditorMode(actor: Actor): EditorMode {
  return actorHasPermission(actor, 'page.restructure') ? 'internal' : 'municipality';
}
