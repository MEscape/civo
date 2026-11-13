import { z } from 'zod';

import { RESOURCE_LIMITS, RESOURCE_TYPES } from '../../application/contracts/booking-constraints';

import { ANY_FILTER } from './parse-service-list-input';

/** The kinds a list of resources can be narrowed to: everything but a person. */
export const RESOURCE_KIND_FILTERS = RESOURCE_TYPES.filter((kind) => kind !== 'employee');

export interface ResourceListParams {
  readonly search: string | undefined;
  readonly type: string | undefined;
  /** As the address carries it: untrusted, resolved and clamped by the use case. */
  readonly page: { readonly page: unknown; readonly pageSize: unknown };
}

/** A repeated parameter (`?q=a&q=b`) is its first value. */
const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const paramsSchema = z.object({
  q: z.preprocess(
    firstOf,
    z.string().trim().max(RESOURCE_LIMITS.searchMax).optional().catch(undefined),
  ),
  type: z.preprocess(firstOf, z.enum(RESOURCE_KIND_FILTERS).optional().catch(undefined)),
  page: z.preprocess(firstOf, z.unknown()),
  pageSize: z.preprocess(firstOf, z.unknown()),
});

/**
 * What the address of the resources list asks for, read without trusting it: a value that does not
 * fit is the default, never an error page. The page and its size are resolved by the use case.
 */
export function parseResourceListParams(
  raw: Readonly<Record<string, string | string[] | undefined>>,
): ResourceListParams {
  const parsed = paramsSchema.parse(raw);
  return {
    search: parsed.q === '' || parsed.q === ANY_FILTER ? undefined : parsed.q,
    type: parsed.type,
    page: { page: parsed.page, pageSize: parsed.pageSize },
  };
}
