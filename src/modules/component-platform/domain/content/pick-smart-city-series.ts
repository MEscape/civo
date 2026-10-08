import { compareText } from './shared-fields';

import type { ContentOf } from './content-definitions';

export interface SeriesPoint {
  readonly date: string;
  readonly value: number;
}

export interface PickedSeries {
  readonly name: string;
  readonly unit: string | undefined;
  /** Chronological, oldest first. */
  readonly points: readonly SeriesPoint[];
}

export interface PickedDistribution {
  /** `undefined` for parts that were given no group. */
  readonly group: string | undefined;
  readonly unit: string | undefined;
  readonly parts: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
  }>;
}

/**
 * The line a trend chart draws out of a dataset of observations. Without a
 * name it takes the series of the newest observation (the list arrives
 * newest first), so a dataset of one measure just works.
 */
export function pickSeries(
  observations: ReadonlyArray<ContentOf<'SmartCityObservation'>>,
  name: string | null,
): PickedSeries | null {
  const wanted = name ?? observations[0]?.series;
  const rows = observations.filter((observation) => observation.series === wanted);
  const [first] = rows;
  if (wanted === undefined || first === undefined) {
    return null;
  }
  return {
    name: wanted,
    unit: first.unit,
    points: rows
      .map((row) => ({ date: row.observedAt, value: row.value }))
      .sort((a, b) => compareText(a.date, b.date)),
  };
}

/**
 * The distribution a donut draws out of a dataset of parts. Without a group
 * it takes the group of the first part, so a dataset of one whole just works.
 */
export function pickDistribution(
  entries: ReadonlyArray<ContentOf<'SmartCityBreakdownEntry'>>,
  group: string | null,
): PickedDistribution | null {
  const [first] = entries;
  if (first === undefined) {
    return null;
  }
  const wanted = group ?? first.group;
  const rows = entries.filter((entry) => entry.group === wanted);
  const [firstRow] = rows;
  if (firstRow === undefined) {
    return null;
  }
  return {
    group: wanted,
    unit: firstRow.unit,
    parts: rows.map((row) => ({ label: row.label, value: row.value })),
  };
}
