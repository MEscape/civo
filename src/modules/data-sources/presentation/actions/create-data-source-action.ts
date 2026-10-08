'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { dataSourceCommands } from '../../composition';
import { invalidateSettings } from '../cache/invalidate';
import { toDataSourceDto } from '../dto/data-source-dto';
import { newDataSourceSchema } from '../schemas/new-data-source-schema';
import { parseDataSourceInput } from '../schemas/parse-data-source-input';

import type { DataSourceDto } from '../dto/data-source-dto';

/**
 * Framework adapter: validate, call the use case, invalidate. The use case
 * itself authenticates and authorizes, so there is no path around it.
 */
export async function createDataSourceAction(input: unknown): Promise<ActionResult<DataSourceDto>> {
  const result = await parseDataSourceInput(newDataSourceSchema, input).asyncAndThen((command) =>
    dataSourceCommands.createDataSource.execute(command),
  );

  if (result.isOk()) {
    invalidateSettings(result.value.websiteId);
  }
  return toActionResult(result.map((view) => toDataSourceDto({ ...view, datasets: [] })));
}
