import { clamp, isDefined } from '@lib/utils';

import { getContentDefinition } from '../domain/content/content-definitions';
import { LIST_LIMITS, MAX_LIST_OFFSET } from '../domain/content/list-scale';

import type { ContentKind } from '../domain/content/content-definitions';

/**
 * Every list is bounded (performance.md). These limits say how many ITEMS a
 * component shows; the bounds come from the kind's own scale
 * (`LIST_LIMITS`), the same ones the builder offers for the Limit. What the
 * data-sources module reads is exactly this window, so nothing is fetched
 * that no component can show.
 */

/** The limit a request gets: its own when it is a whole number, else the scale's initial one, always within the scale's bounds. */
export function resolveListLimit(kind: ContentKind, requested: number | undefined): number {
  const bounds = LIST_LIMITS[getContentDefinition(kind).scale];
  const wanted = isDefined(requested) && Number.isInteger(requested) ? requested : bounds.initial;
  return clamp(wanted, bounds.min, bounds.max);
}

/** The widest window a kind may be read in: what the editor's category choices are collected from. */
export function maxListLimit(kind: ContentKind): number {
  return LIST_LIMITS[getContentDefinition(kind).scale].max;
}

/** Where the window starts: a whole number from 0, anything else is the start of the dataset. */
export function resolveListOffset(requested: number | undefined): number {
  return isDefined(requested) && Number.isInteger(requested)
    ? clamp(requested, 0, MAX_LIST_OFFSET)
    : 0;
}
