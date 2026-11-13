import type { AppResultAsync } from '@lib/result';

import type { BuilderAccess, BuilderAccessError } from '../../domain/ports/builder-access.port';

/**
 * Whether the actor may change the structure of a page and every prop of it
 * (`page.restructure`) in this website, or only the content the components list as theirs.
 * Decided on the server from the actor's memberships in the page's own website, never from a
 * request: the editor session reports it to the screen, and a save is checked against the same
 * answer.
 */
export function mayRestructure(
  access: BuilderAccess,
  websiteId: string,
): AppResultAsync<boolean, BuilderAccessError> {
  return access.mayInWebsite('page.restructure', websiteId);
}
