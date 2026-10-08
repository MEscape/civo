'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { dataSourceCommands } from '../../composition';
import { invalidateRemovedDataSource } from '../cache/invalidate';
import { idSchema } from '../schemas/data-source-fields-schema';
import { parseDataSourceInput } from '../schemas/parse-data-source-input';

export async function deleteDataSourceAction(
  dataSourceId: unknown,
): Promise<ActionResult<{ id: string }>> {
  const result = await parseDataSourceInput(idSchema, dataSourceId).asyncAndThen((id) =>
    dataSourceCommands.deleteDataSource.execute(id),
  );

  if (result.isOk()) {
    const { id, websiteId, removedDatasetIds } = result.value;
    invalidateRemovedDataSource(websiteId, id, removedDatasetIds);
  }
  return toActionResult(result.map(({ id }) => ({ id })));
}
