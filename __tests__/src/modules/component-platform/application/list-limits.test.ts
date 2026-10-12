import { describe, expect, it } from 'vitest';

import {
  maxListLimit,
  resolveListLimit,
  resolveListOffset,
} from '@modules/component-platform/application/list-limits';
import {
  CONTENT_KINDS,
  getContentDefinition,
} from '@modules/component-platform/domain/content/content-definitions';
import {
  LIST_LIMITS,
  MAX_LIST_OFFSET,
} from '@modules/component-platform/domain/content/list-scale';

describe('resolveListLimit', () => {
  it('uses the scale initial limit when nothing or a fraction is requested', () => {
    expect(resolveListLimit('NewsItem', undefined)).toBe(LIST_LIMITS.cards.initial);
    expect(resolveListLimit('NewsItem', 2.5)).toBe(LIST_LIMITS.cards.initial);
    expect(resolveListLimit('GeoFeature', undefined)).toBe(LIST_LIMITS.dataset.initial);
  });

  it('keeps card lists small, however much is asked for', () => {
    expect(resolveListLimit('Event', 5_000)).toBe(LIST_LIMITS.cards.max);
    expect(resolveListLimit('Event', 0)).toBe(LIST_LIMITS.cards.min);
  });

  it('lets a dataset-scale kind read a whole dataset, and no more', () => {
    expect(resolveListLimit('GeoFeature', LIST_LIMITS.dataset.max)).toBe(LIST_LIMITS.dataset.max);
    expect(resolveListLimit('SmartCityObservation', 5_000)).toBe(LIST_LIMITS.dataset.max);
  });

  it('takes the scale from the kind definition, so no other list names the kinds', () => {
    const wide = CONTENT_KINDS.filter((kind) => getContentDefinition(kind).scale === 'dataset');

    expect(wide).toEqual(['SmartCityObservation', 'SmartCityBreakdownEntry', 'GeoFeature']);
    for (const kind of CONTENT_KINDS) {
      expect(maxListLimit(kind)).toBe(LIST_LIMITS[getContentDefinition(kind).scale].max);
    }
  });
});

describe('resolveListOffset', () => {
  it('starts at the beginning unless a whole number is asked for', () => {
    expect(resolveListOffset(undefined)).toBe(0);
    expect(resolveListOffset(1.5)).toBe(0);
    expect(resolveListOffset(-5)).toBe(0);
    expect(resolveListOffset(40)).toBe(40);
    expect(resolveListOffset(MAX_LIST_OFFSET * 2)).toBe(MAX_LIST_OFFSET);
  });
});
