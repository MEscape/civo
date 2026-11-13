import type { AppResult } from '@lib/result';

import {
  pickDistribution,
  pickSeries,
} from '../../../../application/contracts/component-platform-constraints';

import type {
  PickedDistribution,
  PickedSeries,
} from '../../../../application/contracts/component-platform-constraints';
import type {
  ContentListView,
  ContentLoadError,
  ContentOrigin,
} from '../../../../application/contracts/content-views';

/** What the dashboard's optional panels show, and the origin its badge reports. */
export interface DashboardPanels {
  readonly series: PickedSeries | null;
  readonly distribution: PickedDistribution | null;
  readonly origin: ContentOrigin;
}

type Loaded<K extends 'SmartCityMetric' | 'SmartCityObservation' | 'SmartCityBreakdownEntry'> =
  AppResult<ContentListView<K>, ContentLoadError>;

/** An optional panel's content, or `null` when it was not requested or failed to load. */
function valueOrNull<T>(result: AppResult<T, ContentLoadError> | null): T | null {
  return result?.isOk() ? result.value : null;
}

function mergedOrigin(origins: ReadonlyArray<ContentOrigin | undefined>): ContentOrigin {
  const sample = origins.find((origin) => origin?.kind === 'sample');
  if (sample !== undefined) {
    return sample;
  }
  const live = origins.filter((origin) => origin?.kind === 'live');
  const sources = live.flatMap((origin) => origin.sources ?? []);
  const rejected = live.reduce((sum, origin) => sum + (origin.rejected ?? 0), 0);
  return sources.length === 0 && rejected === 0
    ? (live[0] ?? { kind: 'unbound' })
    : { kind: 'live', sources, rejected };
}

/**
 * The trend and the distribution of a dashboard. A failing optional panel is
 * left out rather than taking the whole dashboard down; the badge reports a
 * sample origin of any of the three loads, else the metrics' own.
 */
export function dashboardPanels(
  metrics: ContentListView<'SmartCityMetric'>,
  observations: Loaded<'SmartCityObservation'> | null,
  parts: Loaded<'SmartCityBreakdownEntry'> | null,
): DashboardPanels {
  const trend = valueOrNull(observations);
  const breakdown = valueOrNull(parts);
  return {
    series: trend === null ? null : pickSeries(trend.items, null),
    distribution: breakdown === null ? null : pickDistribution(breakdown.items, null),
    origin: mergedOrigin([metrics.origin, trend?.origin, breakdown?.origin]),
  };
}
