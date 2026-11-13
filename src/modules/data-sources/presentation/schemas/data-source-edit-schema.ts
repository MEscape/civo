import { z } from 'zod';

import { dataSourceNameSchema, idSchema } from './data-source-fields-schema';

/**
 * The edit action's ENVELOPE. As on creation the config is only required to be an object: the
 * domain lays it over the stored connection and validates the result, including the SSRF policy.
 */
export const dataSourceEditSchema = z.object({
  dataSourceId: idSchema,
  name: dataSourceNameSchema,
  config: z.record(z.string(), z.unknown()),
});
