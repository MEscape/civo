'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { dataSourceQueries } from '../../composition';
import { toDiscoveryDto } from '../dto/dataset-dto';
import { idSchema } from '../schemas/data-source-fields-schema';
import { parseDataSourceInput } from '../schemas/parse-data-source-input';

import type { DiscoveryDto } from '../dto/dataset-dto';

/** Calls the external system, so it requires `dataset.map`; it changes nothing, so it invalidates nothing. */
export async function discoverDatasetAction(
  datasetId: unknown,
): Promise<ActionResult<DiscoveryDto>> {
  const result = await parseDataSourceInput(idSchema, datasetId).asyncAndThen((id) =>
    dataSourceQueries.discoverDataset.execute(id),
  );
  return toActionResult(result.map(toDiscoveryDto));
}
