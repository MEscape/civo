import { z } from 'zod';

import { LOCATION_LIMITS } from '../../application/contracts/booking-constraints';

/** The states a list of locations can be narrowed to; no value means all of them. */
export const LOCATION_STATUS_FILTERS = ['all', 'active', 'inactive'] as const;
export type LocationStatusFilter = (typeof LOCATION_STATUS_FILTERS)[number];

export interface LocationListParams {
  readonly search: string | undefined;
  readonly status: LocationStatusFilter;
  /** As the address carries it: untrusted, resolved and clamped by the use case. */
  readonly page: { readonly page: unknown; readonly pageSize: unknown };
}

/** A repeated parameter (`?q=a&q=b`) is its first value. */
const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const paramsSchema = z.object({
  q: z.preprocess(
    firstOf,
    z.string().trim().max(LOCATION_LIMITS.searchMax).optional().catch(undefined),
  ),
  status: z.preprocess(firstOf, z.enum(['active', 'inactive']).optional().catch(undefined)),
  page: z.preprocess(firstOf, z.unknown()),
  pageSize: z.preprocess(firstOf, z.unknown()),
});

/**
 * What the address of the locations list asks for, read without trusting it: a value that does not
 * fit is the default, never an error page. The page and its size are resolved by the use case.
 */
export function parseLocationListParams(
  raw: Readonly<Record<string, string | string[] | undefined>>,
): LocationListParams {
  const parsed = paramsSchema.parse(raw);
  return {
    search: parsed.q === '' ? undefined : parsed.q,
    status: parsed.status ?? 'all',
    page: { page: parsed.page, pageSize: parsed.pageSize },
  };
}

/** The `isActive` filter a status asks for, or none. */
export function isActiveOf(status: LocationStatusFilter): boolean | undefined {
  return status === 'all' ? undefined : status === 'active';
}
