import { clamp, isDefined } from '@lib/utils';

import type { ContentKind } from '../domain/content/content-definitions';

/** Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. */
export const DEFAULT_CONTENT_LIST_LIMIT = 12;
export const MIN_CONTENT_LIST_LIMIT = 1;

/**
 * The ceiling of a card list (news, events, services…). Component props cap
 * themselves far lower (50 at most); this is the backstop for a request that
 * bypasses them.
 */
export const MAX_CONTENT_LIST_LIMIT = 100;

/**
 * The ceiling of a list that reads a dataset as data rather than as cards:
 * a map shows every feature, a chart one row per point or part. It matches
 * the data-sources mapping cap (1000 records per dataset).
 */
export const MAX_DATASET_LIST_LIMIT = 1_000;

/** Kinds whose components consume a whole dataset instead of a page of cards. */
const DATASET_SCALE_KINDS: ReadonlySet<ContentKind> = new Set<ContentKind>([
  'GeoFeature',
  'SmartCityObservation',
  'SmartCityBreakdownEntry',
]);

export function maxListLimitFor(kind: ContentKind): number {
  return DATASET_SCALE_KINDS.has(kind) ? MAX_DATASET_LIST_LIMIT : MAX_CONTENT_LIST_LIMIT;
}

/** The limit a request gets: its own when it is a whole number, else the default, always within the kind's bounds. */
export function resolveListLimit(kind: ContentKind, requested: number | undefined): number {
  const wanted =
    isDefined(requested) && Number.isInteger(requested) ? requested : DEFAULT_CONTENT_LIST_LIMIT;
  return clamp(wanted, MIN_CONTENT_LIST_LIMIT, maxListLimitFor(kind));
}
