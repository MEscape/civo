'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getMapQueries } from '../../composition';
import { toMapWindowDto } from '../dto/map-dto';
import { parseMapInput } from '../schemas/parse-map-input';
import { previewMapWindowSchema } from '../schemas/saved-map-schema';

import type { MapWindowDto } from '../dto/map-dto';

export async function previewMapWindowAction(input: unknown): Promise<ActionResult<MapWindowDto>> {
  const result = await parseMapInput(previewMapWindowSchema, input).asyncAndThen((request) =>
    getMapQueries().previewMapWindow.execute(request),
  );
  return toActionResult(result.map(toMapWindowDto));
}
