import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { pickSeries } from '../../domain/content/smartcity/pick-smart-city-series';
import { fromRateLimitFailure } from '../../domain/errors/component-platform-errors';
import { COMPONENT_PLATFORM_RATE_LIMITS } from '../rate-limits';

import type { TrendWindowDependencies } from '../component-platform-dependencies';
import type { ContentLoadError } from '../contracts/content-views';

/** What a visitor asks for when moving a published chart: one series of one dataset, one window of it. */
export interface TrendWindowRequest {
  readonly websiteId: string;
  readonly datasetId: string;
  /** `null` takes the series of the newest observation. */
  readonly series: string | null;
  readonly category?: string | undefined;
  readonly limit: number;
  readonly offset: number;
}

export interface TrendWindowView {
  readonly points: ReadonlyArray<{ readonly date: string; readonly value: number }>;
  readonly unit: string | undefined;
  /** The dataset holds records beyond this window. */
  readonly hasMore: boolean;
}

export type ReadTrendWindowError = ContentLoadError | RateLimitedAppError | InfrastructureAppError;

/**
 * The part of a published trend chart a visitor moved or zoomed to. Only ever the published view,
 * never sample data, and the dataset is scoped to the website by `ListContent`. Each visitor has a
 * budget of windows, spent before anything is read.
 *
 * @authorization public Public like the page it belongs to; the dataset is scoped to the website and only the published view is served.
 */
export class ReadTrendWindow {
  constructor(private readonly deps: TrendWindowDependencies) {}

  execute({
    series,
    ...request
  }: TrendWindowRequest): AppResultAsync<TrendWindowView, ReadTrendWindowError> {
    const { listContent, rateLimiter, clientAddress } = this.deps;

    return ResultAsync.fromSafePromise(clientAddress.current())
      .andThen((client) =>
        rateLimiter.enforce({
          policy: COMPONENT_PLATFORM_RATE_LIMITS.readTrendWindowClient,
          subject: client,
        }),
      )
      .mapErr(fromRateLimitFailure)
      .andThen(() =>
        listContent.execute({ kind: 'SmartCityObservation', mode: 'published', ...request }),
      )
      .map((view): TrendWindowView => {
        const picked = pickSeries(view.items, series);
        return { points: picked?.points ?? [], unit: picked?.unit, hasMore: view.truncated };
      });
  }
}
