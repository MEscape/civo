import { actorHasPermission } from '@modules/auth';
import type { Actor } from '@modules/auth';

/**
 * Whether the actor may change the structure of a page and every prop of it
 * (`page.restructure`), or only the content the components list as theirs.
 * Decided on the server from the actor's permissions, never from a request:
 * the editor session reports it to the screen, and a save is checked against
 * the same answer.
 */
export function mayRestructure(actor: Actor): boolean {
  return actorHasPermission(actor, 'page.restructure');
}
