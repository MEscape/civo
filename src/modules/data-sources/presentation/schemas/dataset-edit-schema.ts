import { z } from 'zod';

import { datasetNameSchema, idSchema } from './data-source-fields-schema';

export const datasetEditSchema = z.object({
  datasetId: idSchema,
  name: datasetNameSchema.optional(),
  slug: z.string().optional(),
});

export type DatasetEdit = z.infer<typeof datasetEditSchema>;
