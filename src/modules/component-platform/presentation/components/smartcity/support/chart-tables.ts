import { formatTrendDate } from '../trend-chart/trend-time-format';

/** The part of the app formatters the tables need; the server and client ones both fit. */
export interface TableFormatters {
  calendarDate(value: string, options: Intl.DateTimeFormatOptions): string;
  date(value: string, options: Intl.DateTimeFormatOptions): string;
  number(value: number): string;
  percent(value: number, fractionDigits: number): string;
}

/** A formatted number followed by its unit, when there is one. */
export function withUnit(formatted: string, unit: string | undefined): string {
  return unit === undefined ? formatted : `${formatted} ${unit}`;
}

export function metricRows(
  items: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
    readonly unit?: string | undefined;
  }>,
  fmt: TableFormatters,
): string[][] {
  return items.map((item) => [item.label, withUnit(fmt.number(item.value), item.unit)]);
}

export function comparisonRows(
  items: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
    readonly target: number;
  }>,
  fmt: TableFormatters,
): string[][] {
  return items.map((item) => [item.label, fmt.number(item.value), fmt.number(item.target)]);
}

/** Label, value and each part's share of the whole. */
export function distributionRows(
  parts: ReadonlyArray<{ readonly label: string; readonly value: number }>,
  fmt: TableFormatters,
): string[][] {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return parts.map((part) => [
    part.label,
    fmt.number(part.value),
    fmt.percent(total > 0 ? part.value / total : 0, 1),
  ]);
}

export function trendRows(
  series: {
    readonly points: ReadonlyArray<{ readonly date: string; readonly value: number }>;
    readonly unit: string | undefined;
    readonly resolution?: string | undefined;
  },
  fmt: TableFormatters,
): string[][] {
  return series.points.map((point) => [
    formatTrendDate(point.date, fmt, { resolution: series.resolution }),
    withUnit(fmt.number(point.value), series.unit),
  ]);
}
