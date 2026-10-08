'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { dataSourceCommands } from '../../composition';
import { invalidateDatasetConsumers } from '../cache/invalidate';
import { idSchema } from '../schemas/data-source-fields-schema';
import { parseDataSourceInput } from '../schemas/parse-data-source-input';

export async function deleteDatasetAction(
  datasetId: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await parseDataSourceInput(idSchema, datasetId).asyncAndThen((id) =>
    dataSourceCommands.deleteDataset.execute(id),
  );

  if (result.isOk()) {
    invalidateDatasetConsumers(result.value.websiteId, result.value.id);
  }
  return toActionResult(result.map(({ id }) => ({ id })));
}
