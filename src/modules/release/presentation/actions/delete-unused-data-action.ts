'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { invalidateRemovedData, releaseCommands } from '../../composition';
import { deleteUnusedDataSchema } from '../schemas/delete-unused-data-schema';
import { parseReleaseInput } from '../schemas/parse-release-input';

/**
 * Deletes a dataset or a whole source, but only while no draft page and no
 * live page shows it. The data screen calls this instead of the data
 * module's own deletion, which cannot see pages.
 */
export async function deleteUnusedDataAction(
  input: unknown,
): Promise<ActionResult<{ readonly id: string }>> {
  const result = await parseReleaseInput(deleteUnusedDataSchema, input).asyncAndThen((command) =>
    releaseCommands.deleteUnusedData
      .execute(command)
      .map((removal) => ({ removal, id: command.id })),
  );

  if (result.isOk()) {
    invalidateRemovedData(result.value.removal);
  }
  return toActionResult(result.map(({ id }) => ({ id })));
}
