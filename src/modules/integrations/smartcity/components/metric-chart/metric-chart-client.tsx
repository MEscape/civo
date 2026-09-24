"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID_STROKE, TOOLTIP_STYLE, X_AXIS_LINE, Y_AXIS, useChartAnimation } from "../chart-style";

export type MetricChartDatum = {
    label: string;
    value: number;
};

/**
 * The actual chart rendering — isolated in its own "use client" module so
 * the server component that fetches data (metric-chart.tsx) stays a
 * Server Component. Recharts requires a browser environment (measuring
 * container size, etc), so this boundary is kept as small as possible
 * per spec §14.
 */
export function MetricChartClient({ data }: { data: MetricChartDatum[] }) {
    const animate = useChartAnimation();

    return (
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="label" {...AXIS} axisLine={X_AXIS_LINE} />
                    <YAxis {...Y_AXIS} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--civo-color-background)" }} />
                    <Bar dataKey="value" fill="var(--civo-chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={animate} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
