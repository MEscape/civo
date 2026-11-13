'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getMediaQueries } from '../../composition';
import { toMediaAssetPageDto } from '../dto/media-dto';
import { listMediaSchema } from '../schemas/list-media-schema';
import { parseMediaInput } from '../schemas/parse-media-input';

import type { MediaAssetPageDto } from '../dto/media-dto';

/** One page of the named website's files, for the picker. */
export async function listMediaAssetsAction(
  input: unknown,
): Promise<ActionResult<MediaAssetPageDto>> {
  const result = await parseMediaInput(listMediaSchema, input).asyncAndThen(
    ({ websiteId, ...options }) => getMediaQueries().listAssets.execute(websiteId, options),
  );
  return toActionResult(result.map(toMediaAssetPageDto));
}
