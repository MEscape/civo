'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getMediaQueries } from '../../composition';
import { toMediaReadLinkDto } from '../dto/media-dto';
import { mediaTargetSchema } from '../schemas/media-target-schema';
import { parseMediaInput } from '../schemas/parse-media-input';

import type { MediaReadLinkDto } from '../dto/media-dto';

/** A short-lived link to one private file. Never cached, never logged. */
export async function getMediaReadUrlAction(
  input: unknown,
): Promise<ActionResult<MediaReadLinkDto>> {
  const result = await parseMediaInput(mediaTargetSchema, input).asyncAndThen((query) =>
    getMediaQueries().getReadUrl.execute(query),
  );
  return toActionResult(result.map(toMediaReadLinkDto));
}
