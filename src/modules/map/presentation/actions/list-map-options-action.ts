'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { MAP_LIMITS } from '../../application/contracts/map-constraints';
import { getMapQueries } from '../../composition';
import { toMapOptionsDto } from '../dto/map-dto';
import { parseMapInput } from '../schemas/parse-map-input';
import { mapOptionsSchema } from '../schemas/saved-map-schema';

import type { MapOptionsDto } from '../dto/map-dto';

export async function listMapOptionsAction(input: unknown): Promise<ActionResult<MapOptionsDto>> {
  const result = await parseMapInput(mapOptionsSchema, input).asyncAndThen(({ websiteId }) =>
    getMapQueries().listSavedMaps.execute(websiteId, {
      page: 1,
      pageSize: MAP_LIMITS.optionsPageSize,
    }),
  );
  return toActionResult(result.map(toMapOptionsDto));
}
