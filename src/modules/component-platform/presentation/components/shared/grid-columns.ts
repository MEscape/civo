import type { GridColumns } from '@components/layout/layout-primitives';

import { GRID_COLUMN_COUNTS } from '../../../application/contracts/component-platform-constraints';

const [FEWEST_COLUMNS, , , WIDEST_COLUMNS] = GRID_COLUMN_COUNTS;

/** The widest column count up to `max` that the number of items can fill. */
export function columnsForCount(count: number, max: GridColumns = WIDEST_COLUMNS): GridColumns {
  const wanted = Math.min(count, max);
  return GRID_COLUMN_COUNTS.reduce<GridColumns>(
    (columns, step) => (step <= wanted ? step : columns),
    FEWEST_COLUMNS,
  );
}
