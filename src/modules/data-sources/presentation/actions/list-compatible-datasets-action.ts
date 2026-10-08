'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { dataSourceQueries } from '../../composition';
import { toDatasetDto } from '../dto/dataset-dto';
import { listCompatibleSchema } from '../schemas/list-compatible-schema';
import { parseDataSourceInput } from '../schemas/parse-data-source-input';

import type { DatasetDto } from '../dto/dataset-dto';

/**
 * The one READ exposed as a Server Action, because the builder's dataset
 * selector is a Client Component that fetches on mount. Everything else a
 * Server Component loads by calling the query directly.
 */
export async function listCompatibleDatasetsAction(
  input: unknown,
): Promise<ActionResult<DatasetDto[]>> {
  const result = await parseDataSourceInput(listCompatibleSchema, input).asyncAndThen(
    ({ websiteId, canonicalKind }) =>
      dataSourceQueries.listCompatibleDatasets.execute({
        websiteId,
        canonicalKinds: [canonicalKind],
      }),
  );
  return toActionResult(result.map((datasets) => datasets.map(toDatasetDto)));
}
