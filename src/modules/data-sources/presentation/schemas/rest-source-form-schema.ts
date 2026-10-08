import { z } from 'zod';

import {
  AUTH_MODES,
  DATA_SOURCE_VALIDATION_CODES as CODES,
} from '../../application/contracts/data-source-constraints';

import { dataSourceNameSchema } from './data-source-fields-schema';

/**
 * The create form for a REST source. It only gives instant feedback on
 * shape; the server (domain) is the authority on the URL policy.
 */
export const restSourceFormSchema = z.object({
  name: dataSourceNameSchema,
  baseUrl: z
    .string()
    .trim()
    .pipe(z.url({ message: CODES.baseUrlInvalid })),
  authMode: z.enum(AUTH_MODES, { message: CODES.authModeUnsupported }),
});

export type RestSourceForm = z.infer<typeof restSourceFormSchema>;
