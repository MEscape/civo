import { describe, expect, it } from 'vitest';

import { donutSlices } from '@modules/component-platform/presentation/components/smartcity/donut-chart/metric-donut-chart.client';

const parts = (values: number[]) => values.map((value, index) => ({ label: `p${index}`, value }));

describe('donutSlices', () => {
  it('keeps every part while each can have its own colour', () => {
    expect(donutSlices(parts([3, 1, 2]), 'Others', 6)).toEqual(parts([3, 1, 2]));
  });

  it('keeps the largest parts and merges the rest into one slice, so no colour repeats', () => {
    const slices = donutSlices(parts([5, 1, 9, 2, 7, 3, 4, 8]), 'Others', 6);

    expect(slices).toHaveLength(6);
    expect(slices.map((slice) => slice.value)).toEqual([9, 8, 7, 5, 4, 6]);
    expect(slices.at(-1)).toEqual({ label: 'Others', value: 6 });
  });
});
