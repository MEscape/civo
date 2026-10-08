import { z } from 'zod';

import { canonicalKindSchema, datasetNameSchema, idSchema } from './data-source-fields-schema';

/** The slug is derived from the name by the domain unless given. */
export const newDatasetSchema = z.object({
  dataSourceId: idSchema,
  name: datasetNameSchema,
  slug: z.string().optional(),
  canonicalKind: canonicalKindSchema,
});

export type NewDataset = z.infer<typeof newDatasetSchema>;

/** The form only collects what the user decides. */
export const datasetFormSchema = newDatasetSchema.pick({
  name: true,
  canonicalKind: true,
});
export type DatasetForm = z.infer<typeof datasetFormSchema>;
