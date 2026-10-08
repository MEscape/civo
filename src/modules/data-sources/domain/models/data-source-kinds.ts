import { literalGuard } from '@lib/utils';

export const DATA_SOURCE_KINDS = ['MOCK', 'REST'] as const;
export type DataSourceKind = (typeof DATA_SOURCE_KINDS)[number];

/**
 * How a REST source authenticates. Only the MODE is stored; the secret is
 * resolved from server-only configuration at request time and never
 * appears in `config`, a view, a log line or a cache key.
 */
export const AUTH_MODES = ['NONE', 'API_KEY', 'BEARER_TOKEN'] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

/** Outcome of the most recent check. */
export const DATA_SOURCE_STATUSES = ['UNKNOWN', 'OK', 'ERROR'] as const;
export type DataSourceStatus = (typeof DATA_SOURCE_STATUSES)[number];

/** Narrow untrusted text (a stored row, a request value) to a known value. */
export const isDataSourceKind = literalGuard(DATA_SOURCE_KINDS);
export const isAuthMode = literalGuard(AUTH_MODES);
export const isDataSourceStatus = literalGuard(DATA_SOURCE_STATUSES);
