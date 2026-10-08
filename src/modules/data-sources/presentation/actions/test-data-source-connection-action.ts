'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { dataSourceCommands } from '../../composition';
import { invalidateSettings } from '../cache/invalidate';
import { toConnectionTestDto } from '../dto/data-source-dto';
import { idSchema } from '../schemas/data-source-fields-schema';
import { parseDataSourceInput } from '../schemas/parse-data-source-input';

import type { ConnectionTestDto } from '../dto/data-source-dto';

export async function testDataSourceConnectionAction(
  dataSourceId: unknown,
): Promise<ActionResult<ConnectionTestDto>> {
  const result = await parseDataSourceInput(idSchema, dataSourceId).asyncAndThen((id) =>
    dataSourceCommands.testDataSourceConnection.execute(id),
  );

  // The settings list shows status and last-checked after every attempt, healthy or not.
  if (result.isOk()) {
    invalidateSettings(result.value.websiteId);
  }
  return toActionResult(result.map(toConnectionTestDto));
}
