import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONTENT_LIST_LIMIT,
  MAX_CONTENT_LIST_LIMIT,
  MAX_DATASET_LIST_LIMIT,
  resolveListLimit,
} from '@modules/component-platform/application/list-limits';

describe('resolveListLimit', () => {
  it('defaults when nothing or a fraction is requested', () => {
    expect(resolveListLimit('NewsItem', undefined)).toBe(DEFAULT_CONTENT_LIST_LIMIT);
    expect(resolveListLimit('NewsItem', 2.5)).toBe(DEFAULT_CONTENT_LIST_LIMIT);
  });

  it('keeps card lists small, however much is asked for', () => {
    expect(resolveListLimit('Event', 5_000)).toBe(MAX_CONTENT_LIST_LIMIT);
    expect(resolveListLimit('Event', 0)).toBe(1);
  });

  it.each(['GeoFeature', 'SmartCityObservation', 'SmartCityBreakdownEntry'] as const)(
    'lets %s read a whole dataset, and no more',
    (kind) => {
      expect(resolveListLimit(kind, 1_000)).toBe(MAX_DATASET_LIST_LIMIT);
      expect(resolveListLimit(kind, 5_000)).toBe(MAX_DATASET_LIST_LIMIT);
    },
  );
});
