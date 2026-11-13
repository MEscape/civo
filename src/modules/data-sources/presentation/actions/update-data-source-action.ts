'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getDataSourceCommands } from '../../composition';
import { invalidateSourceConsumers } from '../cache/invalidate';
import { toDataSourceDto } from '../dto/data-source-dto';
import { dataSourceEditSchema } from '../schemas/data-source-edit-schema';
import { parseDataSourceInput } from '../schemas/parse-data-source-input';

import type { DataSourceDto } from '../dto/data-source-dto';

/**
 * Framework adapter: validate, call the use case, invalidate. The use case
 * itself authenticates and authorizes, so there is no path around it.
 */
export async function updateDataSourceAction(input: unknown): Promise<ActionResult<DataSourceDto>> {
  const result = await parseDataSourceInput(dataSourceEditSchema, input).asyncAndThen((command) =>
    getDataSourceCommands().updateDataSource.execute(command),
  );

  if (result.isOk()) {
    invalidateSourceConsumers(result.value.websiteId, result.value.id);
  }
  return toActionResult(
    result.map((view) => toDataSourceDto({ ...view, datasets: [], isDatasetListTruncated: false })),
  );
}
