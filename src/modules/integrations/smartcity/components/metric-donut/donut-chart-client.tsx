"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type DonutDatum = { label: string; value: number };

// A small, fixed palette derived from theme tokens plus safe fallbacks.
// Pie/donut charts need N distinct colors, more than the 3 theme colors
// typically provide, so segments beyond the theme palette fall back to
// neutral grays rather than inventing arbitrary brand-clashing hues.
const SEGMENT_COLORS = [
    "var(--civo-color-primary)",
    "var(--civo-color-accent)",
    "var(--civo-color-secondary)",
    "#94a3b8",
    "#cbd5e1",
];

export function DonutChartClient({ data }: { data: DonutDatum[] }) {
    return (
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                        stroke="var(--civo-color-background)"
                        strokeWidth={2}
                    >
                        {data.map((entry, index) => (
                            <Cell key={entry.label} fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            background: "var(--civo-color-surface)",
                            border: "1px solid var(--civo-color-border)",
                            borderRadius: "var(--civo-radius)",
                            fontSize: 13,
                        }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
