'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { dataSourceCommands } from '../../composition';
import { invalidateDatasetConsumers } from '../cache/invalidate';
import { toDatasetDto } from '../dto/dataset-dto';
import { newDatasetSchema } from '../schemas/new-dataset-schema';
import { parseDataSourceInput } from '../schemas/parse-data-source-input';

import type { DatasetDto } from '../dto/dataset-dto';

export async function createDatasetAction(input: unknown): Promise<ActionResult<DatasetDto>> {
  const result = await parseDataSourceInput(newDatasetSchema, input).asyncAndThen((command) =>
    dataSourceCommands.createDataset.execute(command),
  );

  if (result.isOk()) {
    invalidateDatasetConsumers(result.value.websiteId, result.value.id);
  }
  return toActionResult(result.map(toDatasetDto));
}
