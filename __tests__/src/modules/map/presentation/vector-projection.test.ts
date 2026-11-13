import { describe, expect, it } from 'vitest';

import {
  vectorPaths,
  vectorProjection,
} from '@modules/map/presentation/components/canvas/vector-projection';

describe('first-party geographic projection', () => {
  it('keeps north above south and east right of west without stretching longitude', () => {
    const project = vectorProjection([9.9, 49.7, 10, 49.8]);
    const southwest = project([9.9, 49.7]);
    const northeast = project([10, 49.8]);
    expect(northeast[0]).toBeGreaterThan(southwest[0]);
    expect(northeast[1]).toBeLessThan(southwest[1]);
    expect((northeast[0] - southwest[0]) / (southwest[1] - northeast[1])).toBeCloseTo(
      Math.cos((49.75 * Math.PI) / 180),
    );
  });

  it('closes each polygon ring, retaining holes for even-odd rendering', () => {
    const project = vectorProjection([0, 0, 1, 1]);
    const paths = vectorPaths(
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
          [
            [0.2, 0.2],
            [0.8, 0.2],
            [0.8, 0.8],
            [0.2, 0.2],
          ],
        ],
      },
      project,
    );
    expect(paths).toHaveLength(1);
    expect(paths[0]?.match(/ Z/g)).toHaveLength(2);
  });

  it('keeps a single location finite instead of dividing by zero', () => {
    const project = vectorProjection([9.93, 49.79, 9.93, 49.79]);
    expect(project([9.93, 49.79])).toEqual([400, 240]);
    expect(vectorPaths({ type: 'Point', coordinates: [9.93, 49.79] }, project)[0]).not.toMatch(
      /NaN|Infinity/,
    );
  });
});
