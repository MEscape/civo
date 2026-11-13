'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getReleaseCommands, invalidateRemovedMap } from '../../composition';
import { deleteUnusedMapSchema } from '../schemas/delete-unused-map-schema';
import { parseReleaseInput } from '../schemas/parse-release-input';

/**
 * Deletes a saved map, but only while no draft page and no live page places it. The maps screen
 * calls this instead of the map module's own deletion, which cannot see pages.
 */
export async function deleteUnusedMapAction(
  input: unknown,
): Promise<ActionResult<{ readonly id: string }>> {
  const result = await parseReleaseInput(deleteUnusedMapSchema, input).asyncAndThen((command) =>
    getReleaseCommands()
      .deleteUnusedMap.execute(command)
      .map(() => command),
  );
  if (result.isOk()) {
    invalidateRemovedMap(result.value.websiteId, result.value.id);
  }
  return toActionResult(result.map(({ id }) => ({ id })));
}
