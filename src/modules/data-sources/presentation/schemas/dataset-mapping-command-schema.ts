import { z } from 'zod';

import { idSchema } from './data-source-fields-schema';
import { datasetMappingShapeSchema } from './dataset-mapping-schema';

export const datasetMappingCommandSchema = z.object({
  datasetId: idSchema,
  mapping: datasetMappingShapeSchema,
});

export type DatasetMappingCommandInput = z.infer<typeof datasetMappingCommandSchema>;
