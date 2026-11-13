'use client';

import { useState, useTransition } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@components/ui/button';

import { useAppFormatters } from '@i18n/client';

import { cn } from '@lib/utils';

import { readTrendWindowAction } from '../../../actions/read-trend-window-action';
import { ChartFigure } from '../../shared/chart-figure';
import { trendRows } from '../support/chart-tables';

import { MetricTrendChartClient } from './metric-trend-chart.client';
import { formatTrendDate } from './trend-time-format';

import type { TrendWindowDto } from '../../../dto/trend-window-dto';

/** What the chart's table and accessible name say; translated on the server. */
export interface TrendFigureLabels {
  /** The chart's accessible name. */
  readonly label: string;
  /** The table's accessible name. */
  readonly caption: string;
  readonly showData: string;
  readonly dateColumn: string;
  readonly valueColumn: string;
}

export interface TrendWindowLabels {
  readonly group: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly earlier: string;
  readonly later: string;
  readonly failed: string;
  /** Translated, with `{count}`, `{from}` and `{to}` for the visible measurements. */
  readonly status: string;
  readonly figure: TrendFigureLabels;
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

interface TrendView {
  readonly limit: number;
  readonly offset: number;
}

function describe(
  template: string,
  data: TrendWindowDto,
  format: (instant: string) => string,
): string {
  const first = data.points[0]?.date;
  const last = data.points.at(-1)?.date;
  const period = template
    .replaceAll('{count}', String(data.points.length))
    .replaceAll('{from}', first === undefined ? '' : format(first))
    .replaceAll('{to}', last === undefined ? '' : format(last));
  return data.unit === undefined ? period : `${period} · ${data.unit}`;
}

interface WindowButtonProps {
  /** Pending, or at the end of its range. Stays focusable: a button that disables itself under the keyboard drops focus. */
  readonly isBlocked: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
}

function WindowButton({ isBlocked, onPress, children }: WindowButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-disabled={isBlocked ? true : undefined}
      className={cn(
        'h-auto min-h-10 py-1.5 text-start whitespace-normal',
        isBlocked && 'cursor-not-allowed opacity-50 hover:bg-surface',
      )}
      onClick={() => {
        if (!isBlocked) {
          onPress();
        }
      }}
    >
      {children}
    </Button>
  );
}

/**
 * The trend chart with its scale and position under the visitor's control.
 * Zooming out shows more values (a larger window), zooming in fewer; moving
 * earlier or later shifts the window along the dataset by one window. The
 * server reads exactly the window shown, so what the chart does not show is
 * not fetched. The table under the chart always lists the window shown.
 */
export function MetricTrendChartWindow({
  initial,
  source,
  initialLimit,
  bounds,
  labels,
}: MetricTrendChartWindowProps) {
  const fmt = useAppFormatters();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<TrendView>({ limit: initialLimit, offset: 0 });
  const [data, setData] = useState<TrendWindowDto>(initial);
  const [hasFailed, setHasFailed] = useState(false);

  function moveTo(next: TrendView) {
    setHasFailed(false);
    startTransition(async () => {
      const result = await readTrendWindowAction({ ...source, ...next });
      if (!result.ok || result.data.points.length === 0) {
        setHasFailed(true);
        return;
      }
      setView(next);
      setData(result.data);
    });
  }

  const { figure } = labels;

  return (
    <div className="space-y-3">
      <div role="group" aria-label={labels.group} className="flex flex-wrap items-center gap-2">
        <WindowButton
          isBlocked={isPending || view.limit <= bounds.min}
          onPress={() => {
            moveTo({ ...view, limit: Math.max(bounds.min, Math.floor(view.limit / 2)) });
          }}
        >
          {labels.zoomIn}
        </WindowButton>
        <WindowButton
          isBlocked={isPending || view.limit >= bounds.max}
          onPress={() => {
            moveTo({ ...view, limit: Math.min(bounds.max, view.limit * 2) });
          }}
        >
          {labels.zoomOut}
        </WindowButton>
        <WindowButton
          isBlocked={isPending || !data.hasMore}
          onPress={() => {
            moveTo({ ...view, offset: view.offset + view.limit });
          }}
        >
          {labels.earlier}
        </WindowButton>
        <WindowButton
          isBlocked={isPending || view.offset === 0}
          onPress={() => {
            moveTo({ ...view, offset: Math.max(0, view.offset - view.limit) });
          }}
        >
          {labels.later}
        </WindowButton>
        <p role="status" className="text-sm text-copy-muted tabular-nums">
          {hasFailed
            ? labels.failed
            : describe(labels.status, data, (instant) =>
                formatTrendDate(instant, fmt, { resolution: data.resolution }),
              )}
        </p>
      </div>
      <div aria-busy={isPending}>
        <ChartFigure
          label={figure.label}
          showDataLabel={figure.showData}
          table={{
            caption: figure.caption,
            columns: [figure.dateColumn, figure.valueColumn],
            rows: trendRows(data, fmt),
          }}
        >
          <MetricTrendChartClient
            data={data.points}
            unit={data.unit}
            resolution={data.resolution}
          />
        </ChartFigure>
      </div>
    </div>
  );
}
