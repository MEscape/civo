import { describe, expect, it } from 'vitest';

import { trendRows } from '@modules/component-platform/presentation/components/smartcity/support/chart-tables';
import { trendAxisFormat } from '@modules/component-platform/presentation/components/smartcity/trend-chart/trend-time-format';

import { createAppFormatters } from '@/i18n/formatters/app-formatters';

const fmt = createAppFormatters('de', 'Europe/Berlin');
const points = [
  { date: '2026-11-06T08:00:00.000Z', value: 142 },
  { date: '2026-11-06T08:05:00.000Z', value: 143 },
];

describe('trend time precision', () => {
  it('keeps date-only daily buckets as source dates instead of inventing a local measurement hour', () => {
    const pacific = createAppFormatters('en', 'America/Los_Angeles');
    const rows = trendRows(
      {
        points: [{ date: '2026-11-04T00:00:00.000Z', value: 196 }],
        unit: 'bikes/day',
        resolution: 'P1D',
      },
      pacific,
    );
    expect(rows[0]?.[0]).toContain('04');
    expect(rows[0]?.[0]).not.toContain(':');
    expect(trendAxisFormat(points, 'P1D')).not.toHaveProperty('hour');
  });
  it('labels a yearly bucket with its year alone, never a time of day', () => {
    const rows = trendRows(
      {
        points: [{ date: '2024-01-01T00:00:00.000Z', value: 132215 }],
        unit: 'Personen',
        resolution: 'P1Y',
      },
      createAppFormatters('de', 'America/Los_Angeles'),
    );
    expect(rows[0]?.[0]).toBe('2024');
    expect(trendAxisFormat(points, 'P1Y')).toEqual({ year: 'numeric', timeZone: 'UTC' });
  });
  it('distinguishes intra-day axis labels with local time instead of repeating the date', () => {
    const options = trendAxisFormat(points);
    const labels = points.map((point) => fmt.date(point.date, options));
    expect(labels).toEqual(['09:00', '09:05']);
  });
  it('adds seconds when zoomed into sub-minute observations', () => {
    const data = [{ date: '2026-11-06T08:00:00.000Z' }, { date: '2026-11-06T08:00:30.000Z' }];
    expect(trendAxisFormat(data)).toMatchObject({ second: '2-digit' });
  });
  it('keeps date context for multi-day and multi-year windows', () => {
    expect(
      trendAxisFormat([{ date: '2026-11-06T08:00:00Z' }, { date: '2026-11-08T08:00:00Z' }]),
    ).toMatchObject({ day: '2-digit', hour: '2-digit' });
    expect(
      trendAxisFormat([{ date: '2024-01-01T00:00:00Z' }, { date: '2026-01-01T00:00:00Z' }]),
    ).toMatchObject({ year: 'numeric' });
  });
  it('retains complete, distinct measurement instants in the table alternative', () => {
    const rows = trendRows({ points, unit: 'cm' }, fmt);
    expect(rows[0]?.[0]).toContain('09:00:00');
    expect(rows[1]?.[0]).toContain('09:05:00');
    expect(rows[0]?.[1]).toBe('142 cm');
    expect(rows[0]?.[0]).not.toBe(rows[1]?.[0]);
  });
});
