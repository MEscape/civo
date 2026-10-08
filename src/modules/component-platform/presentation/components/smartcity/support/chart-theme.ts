/**
 * Recharts takes colours as strings, so the theme tokens are named once
 * here. They reference the --civo-* variables directly (declared on :root
 * and overridden per website by the theme provider), not the Tailwind
 * --color-* aliases, which `@theme inline` does not guarantee to emit.
 */
export const CHART_COLORS = {
  border: 'var(--civo-color-border)',
  text: 'var(--civo-color-text)',
  muted: 'var(--civo-color-text-muted)',
  surface: 'var(--civo-color-surface)',
  background: 'var(--civo-color-background)',
  /** The -copy variant: the raw brand colour can fail contrast on the page. */
  primary: 'var(--civo-color-primary-copy)',
} as const;

/**
 * Categorical series colours, in the order the palette is designed for
 * (dark / mid / light / light-tint alternate, so neighbours stay distinct).
 * Never identify data by colour alone: pair it with text.
 */
export const CHART_SERIES_COLORS = [
  'var(--civo-chart-1)',
  'var(--civo-chart-2)',
  'var(--civo-chart-3)',
  'var(--civo-chart-4)',
  'var(--civo-chart-5)',
  'var(--civo-chart-6)',
] as const;

export const TOOLTIP_STYLE = {
  background: CHART_COLORS.surface,
  color: CHART_COLORS.text,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 'var(--civo-radius)',
  fontSize: 13,
} as const;

export const AXIS_FONT_SIZE = 12;

const BAR_CORNER_RADIUS = 4;

/** Rounded top corners and square bottom corners: bars grow from the axis. */
export const BAR_RADIUS: [number, number, number, number] = [
  BAR_CORNER_RADIUS,
  BAR_CORNER_RADIUS,
  0,
  0,
];
