'use server';

import { revalidateLocalizedPath } from '@i18n/server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getMediaCommands } from '../../composition';
import { mediaRoutes } from '../routes';
import { mediaTargetSchema } from '../schemas/media-target-schema';
import { parseMediaInput } from '../schemas/parse-media-input';

/** Removes one file of the named website, unless the website still uses it. */
export async function deleteMediaAssetAction(
  input: unknown,
): Promise<ActionResult<{ readonly id: string }>> {
  const result = await parseMediaInput(mediaTargetSchema, input).asyncAndThen((command) =>
    getMediaCommands()
      .deleteAsset.execute(command)
      .map(() => command),
  );
  if (result.isOk()) {
    revalidateLocalizedPath(mediaRoutes.library(result.value.websiteId));
  }
  return toActionResult(result.map(({ id }) => ({ id })));
}
