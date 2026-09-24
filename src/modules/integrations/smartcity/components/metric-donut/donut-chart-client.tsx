"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils/cn";
import { TOOLTIP_STYLE, useChartAnimation } from "../chart-style";
import {formatNumber, formatShare} from "@/lib/utils/formatters";

export type DonutDatum = { label: string; value: number };

// Categorical palette lives in globals.css (--civo-chart-*), derived from the
// website theme. `swatch` must be a literal class name so Tailwind sees it.
// Segments beyond the palette cycle, which is why every segment is also
// named and quantified in the text list below the ring.
const SEGMENTS = [
    { fill: "var(--civo-chart-1)", swatch: "bg-chart-1" },
    { fill: "var(--civo-chart-2)", swatch: "bg-chart-2" },
    { fill: "var(--civo-chart-3)", swatch: "bg-chart-3" },
    { fill: "var(--civo-chart-4)", swatch: "bg-chart-4" },
    { fill: "var(--civo-chart-5)", swatch: "bg-chart-5" },
    { fill: "var(--civo-chart-6)", swatch: "bg-chart-6" },
] as const;

/**
 * Ring chart plus a text legend with each segment's share.
 *
 * The legend is real text in neutral ink: the color lives only on the
 * swatch, so a brand color that is illegible as text can never make a label
 * illegible, and the data reaches screen readers as a list. The ring itself
 * is therefore hidden from assistive technology (it would only repeat the
 * list as an unlabeled image).
 */
export function DonutChartClient({ data }: { data: DonutDatum[] }) {
    const animate = useChartAnimation();
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const chartData = data.map((entry, index) => ({
        ...entry,
        fill: SEGMENTS[index % SEGMENTS.length].fill,
    }));

    return (
        <div>
            <div className="h-64 w-full" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                    {/* Two Recharts defaults make this chart keyboard-focusable: the accessibility
                        layer (the SVG becomes a tab stop with role="application") and the Pie's own
                        rootTabIndex (0). Inside this aria-hidden wrapper either would let keyboard
                        users focus something screen readers cannot see, so both are switched off.
                        The list below is the accessible version of the chart. */}
                    <PieChart accessibilityLayer={false}>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="label"
                            innerRadius="55%"
                            outerRadius="80%"
                            paddingAngle={2}
                            stroke="var(--civo-color-background)"
                            strokeWidth={2}
                            rootTabIndex={-1}
                            isAnimationActive={animate}
                        />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatNumber(Number(value))} />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <ul className="mt-2 space-y-1.5 text-sm">
                {data.map((entry, index) => (
                    <li key={entry.label} className="flex items-center gap-2">
                        <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-sm", SEGMENTS[index % SEGMENTS.length].swatch)} />
                        <span className="min-w-0 flex-1 text-copy">{entry.label}</span>
                        {total > 0 && <span className="tabular-nums text-copy-muted">{formatShare(entry.value / total)}</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
}
