'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getMapQueries } from '../../composition';
import { toMapWindowDto } from '../dto/map-dto';
import { parseMapInput } from '../schemas/parse-map-input';
import { inlineMapWindowSchema } from '../schemas/saved-map-schema';

import type { MapWindowDto } from '../dto/map-dto';

export async function readInlineMapWindowAction(
  input: unknown,
): Promise<ActionResult<MapWindowDto>> {
  const result = await parseMapInput(inlineMapWindowSchema, input).asyncAndThen((request) =>
    getMapQueries().readInlineMapWindow.execute(request),
  );
  return toActionResult(result.map(toMapWindowDto));
}
