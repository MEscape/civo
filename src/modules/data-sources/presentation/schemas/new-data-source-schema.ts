import { z } from 'zod';

import {
  DATA_SOURCE_KINDS,
  DATA_SOURCE_VALIDATION_CODES as CODES,
} from '../../application/contracts/data-source-constraints';

import { dataSourceNameSchema, idSchema } from './data-source-fields-schema';

/**
 * The action ENVELOPE. The config is kind-specific and its rules (including
 * the SSRF policy) live in the domain, so it is only required to be an
 * object here; the domain validates it and reports field codes.
 */
export const newDataSourceSchema = z.object({
  websiteId: idSchema,
  name: dataSourceNameSchema,
  kind: z.enum(DATA_SOURCE_KINDS, { message: CODES.kindUnknown }),
  config: z.record(z.string(), z.unknown()),
});

export type NewDataSource = z.infer<typeof newDataSourceSchema>;
