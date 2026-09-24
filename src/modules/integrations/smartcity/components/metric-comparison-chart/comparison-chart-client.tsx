"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID_STROKE, TOOLTIP_STYLE, X_AXIS_LINE, Y_AXIS, useChartAnimation } from "../chart-style";

export type ComparisonDatum = { label: string; value: number; target?: number };

/**
 * ComparisonChartClient — grouped bar chart comparing current value
 * against target across several metrics at once (spec: Smart City viz
 * batch). Distinct from the existing single-series metric-chart-client:
 * this always renders two series (value vs. target) side by side, which
 * is the "comparison" the component name promises rather than a plain
 * bar chart with a different data source.
 */
export function ComparisonChartClient({ data }: { data: ComparisonDatum[] }) {
    const hasTargets = data.some((d) => d.target !== undefined);
    const animate = useChartAnimation();

    return (
        <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="label" {...AXIS} axisLine={X_AXIS_LINE} />
                    <YAxis {...Y_AXIS} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--civo-color-background)" }} />
                    {/* Neutral legend text: Recharts colors it like the series, and a brand accent is often illegible as text. */}
                    {hasTargets && (
                        <Legend
                            wrapperStyle={{ fontSize: 12 }}
                            formatter={(value: string) => <span className="text-copy">{value}</span>}
                        />
                    )}
                    <Bar dataKey="value" name="Ist-Wert" fill="var(--civo-chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={animate} />
                    {hasTargets && (
                        <Bar dataKey="target" name="Zielwert" fill="var(--civo-chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={animate} />
                    )}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
