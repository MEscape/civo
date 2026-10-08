'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { dataSourceQueries } from '../../composition';
import { toMappingPreviewDto } from '../dto/dataset-dto';
import { datasetMappingCommandSchema } from '../schemas/dataset-mapping-command-schema';
import { parseDataSourceInput } from '../schemas/parse-data-source-input';

import type { MappingPreviewDto } from '../dto/dataset-dto';

export async function previewDatasetMappingAction(
  input: unknown,
): Promise<ActionResult<MappingPreviewDto>> {
  const result = await parseDataSourceInput(datasetMappingCommandSchema, input).asyncAndThen(
    (command) => dataSourceQueries.previewDatasetMapping.execute(command),
  );
  return toActionResult(result.map(toMappingPreviewDto));
}
