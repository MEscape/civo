'use server';

import { revalidateLocalizedPath } from '@i18n/server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getMediaCommands } from '../../composition';
import { toMediaAssetDto } from '../dto/media-dto';
import { mediaRoutes } from '../routes';
import { mediaTargetSchema } from '../schemas/media-target-schema';
import { parseMediaInput } from '../schemas/parse-media-input';

import type { MediaAssetDto } from '../dto/media-dto';

/** Says the browser has finished uploading. The server checks the stored file before believing it. */
export async function completeMediaUploadAction(
  input: unknown,
): Promise<ActionResult<MediaAssetDto>> {
  const result = await parseMediaInput(mediaTargetSchema, input).asyncAndThen((command) =>
    getMediaCommands()
      .completeUpload.execute(command)
      .map((asset) => ({ asset, websiteId: command.websiteId })),
  );
  if (result.isOk()) {
    revalidateLocalizedPath(mediaRoutes.library(result.value.websiteId));
  }
  return toActionResult(result.map(({ asset }) => toMediaAssetDto(asset)));
}
