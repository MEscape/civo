'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  AXIS_FONT_SIZE,
  BAR_RADIUS,
  CHART_COLORS,
  CHART_SERIES_COLORS,
  TOOLTIP_STYLE,
} from '@components/ui/chart-theme';

/** One day, its texts already translated and formatted on the server. */
export interface WeekChartDay {
  readonly day: string;
  /** The axis label, e.g. "Mon 12". */
  readonly label: string;
  /** What the tooltip says, e.g. "Mon 12 Oct: 5 bookings, 2 waiting for an employee". */
  readonly summary: string;
  readonly covered: number;
  readonly waiting: number;
}

export interface OverviewWeekChartProps {
  readonly days: readonly WeekChartDay[];
  readonly names: { readonly covered: string; readonly waiting: string };
}

interface DayTooltipProps {
  readonly active?: boolean;
  readonly payload?: ReadonlyArray<{ readonly payload?: WeekChartDay }>;
}

/** The day's sentence, not one number per series: the counts are read, the colours only point. */
function DayTooltip({ active, payload }: DayTooltipProps) {
  const day = payload?.[0]?.payload;
  if (!active || day === undefined) {
    return null;
  }
  return (
    <p style={TOOLTIP_STYLE} className="px-2 py-1">
      {day.summary}
    </p>
  );
}

/**
 * The bookings of the week ahead per day, those still waiting for an employee stacked on top in the
 * warning colour. Decorative for assistive technology: the card states the totals in text and
 * carries the same numbers as a table.
 */
export function OverviewWeekChart({ days, names }: OverviewWeekChartProps) {
  return (
    <div aria-hidden="true" className="size-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer={false}
          data={[...days]}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={CHART_COLORS.muted}
            fontSize={AXIS_FONT_SIZE}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.border }}
            interval={0}
          />
          <YAxis
            stroke={CHART_COLORS.muted}
            fontSize={AXIS_FONT_SIZE}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={28}
          />
          <Tooltip content={<DayTooltip />} cursor={{ fill: CHART_COLORS.background }} />
          <Bar
            dataKey="covered"
            name={names.covered}
            stackId="day"
            fill={CHART_SERIES_COLORS[0]}
            stroke={CHART_COLORS.surface}
            radius={BAR_RADIUS}
          />
          <Bar
            dataKey="waiting"
            name={names.waiting}
            stackId="day"
            fill={CHART_COLORS.warning}
            stroke={CHART_COLORS.surface}
            radius={BAR_RADIUS}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
