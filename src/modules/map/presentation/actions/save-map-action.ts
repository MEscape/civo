'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getMapCommands } from '../../composition';
import { invalidateMapScreens } from '../cache/invalidate';
import { toSavedMapDto } from '../dto/map-dto';
import { parseMapInput } from '../schemas/parse-map-input';
import { saveMapSchema } from '../schemas/saved-map-schema';

import type { SavedMapDto } from '../dto/map-dto';

export async function saveMapAction(input: unknown): Promise<ActionResult<SavedMapDto>> {
  const result = await parseMapInput(saveMapSchema, input).asyncAndThen((request) =>
    getMapCommands().saveMap.execute(request),
  );
  if (result.isOk()) {
    invalidateMapScreens(result.value.websiteId, result.value.id);
  }
  return toActionResult(result.map(toSavedMapDto));
}
