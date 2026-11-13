import { describe, expect, it } from 'vitest';

import { layoutOf } from '@modules/map/presentation/components/explorer/map-sidebar';

describe('the map explorer layout', () => {
  it('gives the map the whole width when nothing stands beside it', () => {
    expect(layoutOf(false)).toEqual({ hasSidebar: false, grid: '', main: '' });
  });

  it('keeps a third of the width for filters and legend when there are any', () => {
    expect(layoutOf(true)).toEqual({
      hasSidebar: true,
      grid: '@4xl:grid-cols-3',
      main: '@4xl:col-span-2',
    });
  });
});
