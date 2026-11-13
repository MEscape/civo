import { z } from 'zod';

import {
  BOOKING_ID_MAX_LENGTH,
  SERVICE_LIMITS,
  SERVICE_ORIGINS,
} from '../../application/contracts/booking-constraints';

import type { ServiceOriginKind } from '../../application/contracts/booking-constraints';

/** The states a list of services can be narrowed to. The list starts on the running ones. */
export const SERVICE_STATUS_FILTERS = ['active', 'inactive', 'all'] as const;
export type ServiceStatusFilter = (typeof SERVICE_STATUS_FILTERS)[number];

export interface ServiceListParams {
  readonly search: string | undefined;
  readonly category: string | undefined;
  readonly origin: ServiceOriginKind | undefined;
  readonly status: ServiceStatusFilter;
  /** As the address carries it: untrusted, resolved and clamped by the use case. */
  readonly page: { readonly page: unknown; readonly pageSize: unknown };
}

/** A repeated parameter (`?q=a&q=b`) is its first value. */
const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const text = (max: number) =>
  z.preprocess(firstOf, z.string().trim().max(max).optional().catch(undefined));

const paramsSchema = z.object({
  q: text(SERVICE_LIMITS.searchMax),
  category: text(SERVICE_LIMITS.categoryMax),
  origin: z.preprocess(firstOf, z.enum(SERVICE_ORIGINS).optional().catch(undefined)),
  status: z.preprocess(firstOf, z.enum(SERVICE_STATUS_FILTERS).optional().catch(undefined)),
  page: z.preprocess(firstOf, z.unknown()),
  pageSize: z.preprocess(firstOf, z.unknown()),
});

/** What a select of the filter strip submits for "any": a Radix select has no empty option. */
export const ANY_FILTER = '*';

const blankAsNone = (value: string | undefined) =>
  value === '' || value === ANY_FILTER ? undefined : value;

/**
 * What the address of the services list asks for, read without trusting it: a value that does not
 * fit is the default, never an error page. A list with no status asked for shows the running
 * services; the page and its size are resolved by the use case.
 */
export function parseServiceListParams(
  raw: Readonly<Record<string, string | string[] | undefined>>,
): ServiceListParams {
  const parsed = paramsSchema.parse(raw);
  return {
    search: blankAsNone(parsed.q),
    category: blankAsNone(parsed.category),
    origin: parsed.origin,
    status: parsed.status ?? 'active',
    page: { page: parsed.page, pageSize: parsed.pageSize },
  };
}

/** The status the use case filters by: `all` is no filter. */
export function statusOf(status: ServiceStatusFilter): 'active' | 'inactive' | undefined {
  return status === 'all' ? undefined : status;
}

/** What the address of the adopt screen asks for. */
export interface AdoptParams {
  readonly search: string | undefined;
  readonly source: string | undefined;
  /** The service picked in the list, if any, and the location it was picked from. */
  readonly service: string | undefined;
  readonly from: string | undefined;
  readonly page: { readonly page: unknown; readonly pageSize: unknown };
}

const adoptSchema = z.object({
  q: text(SERVICE_LIMITS.searchMax),
  source: text(BOOKING_ID_MAX_LENGTH),
  service: text(BOOKING_ID_MAX_LENGTH),
  from: text(BOOKING_ID_MAX_LENGTH),
  page: z.preprocess(firstOf, z.unknown()),
  pageSize: z.preprocess(firstOf, z.unknown()),
});

export function parseAdoptParams(
  raw: Readonly<Record<string, string | string[] | undefined>>,
): AdoptParams {
  const parsed = adoptSchema.parse(raw);
  return {
    search: blankAsNone(parsed.q),
    source: blankAsNone(parsed.source),
    service: blankAsNone(parsed.service),
    from: blankAsNone(parsed.from),
    page: { page: parsed.page, pageSize: parsed.pageSize },
  };
}
