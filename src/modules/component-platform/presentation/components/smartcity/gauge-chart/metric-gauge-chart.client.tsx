'use client';

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';

import { CHART_COLORS } from '@components/ui/chart-theme';

import { useAppFormatters } from '@i18n/client';

import { clamp } from '@lib/utils';

const MAX_PERCENT = 100;

export interface MetricGaugeChartClientProps {
  readonly percent: number;
  /** Caption below the percentage, e.g. "of target". */
  readonly caption: string;
}

/** Progress-to-target gauge, e.g. "62 % of the 2030 CO₂ goal". */
export function MetricGaugeChartClient({ percent, caption }: MetricGaugeChartClientProps) {
  const fmt = useAppFormatters();
  const clamped = clamp(percent, 0, MAX_PERCENT);
  const data = [{ name: 'progress', value: clamped, fill: CHART_COLORS.primary }];

  return (
    <div className="relative h-56 w-56">
      {/* The arc is decorative: the percentage and caption below are real text. */}
      <div aria-hidden="true" className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            accessibilityLayer={false}
            innerRadius="70%"
            outerRadius="100%"
            barSize={16}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, MAX_PERCENT]} tick={false} axisLine={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={8}
              background={{ fill: CHART_COLORS.border }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl text-primary-copy">
          {fmt.percent(clamped / MAX_PERCENT, 0)}
        </span>
        <span className="text-sm text-copy-muted">{caption}</span>
      </div>
    </div>
  );
}
