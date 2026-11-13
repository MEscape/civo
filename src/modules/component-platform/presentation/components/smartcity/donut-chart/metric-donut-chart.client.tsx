'use client';

import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import {
  AXIS_FONT_SIZE,
  CHART_COLORS,
  CHART_SERIES_COLORS,
  TOOLTIP_STYLE,
} from '@components/ui/chart-theme';

export interface DonutDatum {
  readonly label: string;
  readonly value: number;
}

/**
 * At most one slice per palette colour, so no two slices look alike: the
 * largest parts keep their own slice and the rest share one. The data table
 * beside the chart still lists every part.
 */
export function donutSlices(
  data: readonly DonutDatum[],
  othersLabel: string,
  colors: number = CHART_SERIES_COLORS.length,
): DonutDatum[] {
  if (data.length <= colors) {
    return [...data];
  }
  const sorted = [...data].sort((first, second) => second.value - first.value);
  const rest = sorted.slice(colors - 1);
  return [
    ...sorted.slice(0, colors - 1),
    { label: othersLabel, value: rest.reduce((sum, part) => sum + part.value, 0) },
  ];
}

export function MetricDonutChartClient({
  data,
  othersLabel,
}: {
  readonly data: readonly DonutDatum[];
  readonly othersLabel: string;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart accessibilityLayer={false}>
          <Pie
            // Each sector takes its colour from its entry (`Cell` is deprecated in Recharts).
            data={donutSlices(data, othersLabel).map((entry, index) => ({
              ...entry,
              fill: CHART_SERIES_COLORS[index] ?? CHART_COLORS.primary,
            }))}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke={CHART_COLORS.background}
            strokeWidth={2}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {/* The swatch carries the colour; pale series colours as text would fail contrast. */}
          <Legend
            wrapperStyle={{ fontSize: AXIS_FONT_SIZE }}
            formatter={(value: string) => <span className="text-copy">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
