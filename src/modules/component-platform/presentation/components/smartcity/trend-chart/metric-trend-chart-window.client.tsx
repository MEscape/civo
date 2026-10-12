'use client';

import { useState, useTransition } from 'react';

import { Button } from '@components/ui/button';

import { readTrendWindowAction } from '../../../actions/read-trend-window-action';

import { MetricTrendChartClient } from './metric-trend-chart.client';

import type { TrendDatum } from './metric-trend-chart.client';
import type { TrendWindowDto } from '../../../dto/trend-window-dto';

export interface TrendWindowLabels {
  readonly group: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly earlier: string;
  readonly later: string;
  readonly failed: string;
  /** Translated, with `{limit}` and `{offset}` where the numbers go. */
  readonly status: string;
}

export interface MetricTrendChartWindowProps {
  readonly initial: TrendWindowDto;
  /** Which part of which dataset the chart shows; scoped to the website by the use case. */
  readonly source: {
    readonly websiteId: string;
    readonly datasetId: string;
    readonly series: string | null;
    readonly category: string | undefined;
  };
  /** The Limit the editor set: where zooming starts. */
  readonly initialLimit: number;
  /** The Limit bounds of the kind; zooming never leaves them. */
  readonly bounds: { readonly min: number; readonly max: number };
  readonly labels: TrendWindowLabels;
}

function describe(template: string, window: Window): string {
  return template
    .replaceAll('{limit}', String(window.limit))
    .replaceAll('{offset}', String(window.offset));
}

interface Window {
  readonly limit: number;
  readonly offset: number;
}

/**
 * The trend chart with its scale and position under the visitor's control.
 * Zooming out shows more values (a larger window), zooming in fewer; moving
 * earlier or later shifts the window along the dataset by one window. The
 * server reads exactly the window shown, so what the chart does not show is
 * not fetched.
 */
export function MetricTrendChartWindow({
  initial,
  source,
  initialLimit,
  bounds,
  labels,
}: MetricTrendChartWindowProps) {
  const [isPending, startTransition] = useTransition();
  const [window, setWindow] = useState<Window>({ limit: initialLimit, offset: 0 });
  const [data, setData] = useState<TrendWindowDto>(initial);
  const [hasFailed, setHasFailed] = useState(false);

  function moveTo(next: Window) {
    setHasFailed(false);
    startTransition(async () => {
      const result = await readTrendWindowAction({ ...source, ...next });
      if (!result.ok) {
        setHasFailed(true);
        return;
      }
      setWindow(next);
      setData(result.data);
    });
  }

  const points: readonly TrendDatum[] = data.points;

  return (
    <div className="space-y-3">
      <div role="group" aria-label={labels.group} className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || window.limit <= bounds.min}
          onClick={() => {
            moveTo({ ...window, limit: Math.max(bounds.min, Math.floor(window.limit / 2)) });
          }}
        >
          {labels.zoomIn}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || window.limit >= bounds.max}
          onClick={() => {
            moveTo({ ...window, limit: Math.min(bounds.max, window.limit * 2) });
          }}
        >
          {labels.zoomOut}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || !data.hasMore}
          onClick={() => {
            moveTo({ ...window, offset: window.offset + window.limit });
          }}
        >
          {labels.earlier}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || window.offset === 0}
          onClick={() => {
            moveTo({ ...window, offset: Math.max(0, window.offset - window.limit) });
          }}
        >
          {labels.later}
        </Button>
        <p role="status" className="text-xs text-copy-muted">
          {hasFailed ? labels.failed : describe(labels.status, window)}
        </p>
      </div>
      <div aria-busy={isPending}>
        <MetricTrendChartClient data={points} unit={data.unit} />
      </div>
    </div>
  );
}
