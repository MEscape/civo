import { z } from 'zod';

import {
  AUTH_MODES,
  DATA_SOURCE_VALIDATION_CODES as CODES,
  PAGINATION_KINDS,
} from '../../application/contracts/data-source-constraints';

import { dataSourceNameSchema } from './data-source-fields-schema';

/**
 * The create form for a REST source. It only gives instant feedback on
 * shape; the server (domain) is the authority on the URL policy and on
 * whether the pagination settings fit together. The pagination fields are
 * text, as typed: `toRestConfig` turns them into the config the server checks.
 */
export const restSourceFormSchema = z.object({
  name: dataSourceNameSchema,
  baseUrl: z
    .string()
    .trim()
    .pipe(z.url({ message: CODES.baseUrlInvalid })),
  authMode: z.enum(AUTH_MODES, { message: CODES.authModeUnsupported }),
  recordsPath: z.string().trim(),
  paginationKind: z.enum(PAGINATION_KINDS, { message: CODES.paginationInvalid }),
  pageSize: z.string().trim(),
  limitParam: z.string().trim(),
  offsetParam: z.string().trim(),
  pageParam: z.string().trim(),
  sizeParam: z.string().trim(),
  cursorParam: z.string().trim(),
  nextCursorPath: z.string().trim(),
  nextUrlPath: z.string().trim(),
});

export type RestSourceForm = z.infer<typeof restSourceFormSchema>;

export const REST_SOURCE_FORM_DEFAULTS: RestSourceForm = {
  name: '',
  baseUrl: '',
  authMode: 'NONE',
  recordsPath: '',
  paginationKind: 'none',
  pageSize: '',
  limitParam: '',
  offsetParam: '',
  pageParam: '',
  sizeParam: '',
  cursorParam: '',
  nextCursorPath: '',
  nextUrlPath: '',
};
