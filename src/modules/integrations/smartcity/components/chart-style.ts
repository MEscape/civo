import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { formatNumber } from "@/lib/utils/formatters";

/**
 * The look shared by every Smart City chart, so axes, grid and tooltips
 * cannot drift apart between widgets. Colors are token references (charts
 * take them as props, not classes): data marks use the --civo-chart-*
 * palette, which is guaranteed legible on the page background.
 */

export const GRID_STROKE = "var(--civo-color-border)";

/** Text axes. Muted ink meets 4.5:1 on both page surfaces. */
export const AXIS = {
    stroke: "var(--civo-color-text-muted)",
    fontSize: 12,
    tickLine: false,
} as const;

export const X_AXIS_LINE = { stroke: "var(--civo-color-border)" } as const;

/**
 * Value axis. `width: "auto"` lets Recharts measure the widest label; a fixed
 * width cut the leading digit off five-digit values ("16000" drew as
 * "l6000"). The formatter writes German thousands separators ("16.000").
 */
export const Y_AXIS = {
    ...AXIS,
    axisLine: false,
    width: "auto",
    tickFormatter: (value: number) => formatNumber(value),
} as const;

export const TOOLTIP_STYLE = {
    background: "var(--civo-color-surface)",
    border: "1px solid var(--civo-color-border)",
    borderRadius: "var(--civo-radius)",
    fontSize: 13,
} as const;

/**
 * Whether chart entry animations should run. Recharts animates in
 * JavaScript, which the CSS `prefers-reduced-motion` rule cannot switch off.
 */
export function useChartAnimation(): boolean {
    return !usePrefersReducedMotion();
}
