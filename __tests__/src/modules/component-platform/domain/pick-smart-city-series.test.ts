import { describe, expect, it } from 'vitest';

import {
  pickDistribution,
  pickSeries,
} from '@modules/component-platform/domain/content/smartcity/pick-smart-city-series';

describe('pick-smart-city-series domain logic', () => {
  describe('pickSeries', () => {
    const observations = [
      {
        id: 'o1',
        series: 'pm10',
        observedAt: '2026-10-12T14:00:00.000Z',
        value: 15,
        unit: 'µg/m³',
        category: 'sustainability' as const,
      },
      {
        id: 'o2',
        series: 'co2',
        observedAt: '2026-10-12T14:00:00.000Z',
        value: 420,
        unit: 'ppm',
        category: 'sustainability' as const,
      },
      {
        id: 'o3',
        series: 'pm10',
        observedAt: '2026-10-12T10:00:00.000Z',
        value: 20,
        unit: 'µg/m³',
        category: 'sustainability' as const,
      },
    ];

    it('picks explicit series by name and sorts points chronologically', () => {
      const series = pickSeries(observations, 'pm10');
      expect(series).not.toBeNull();
      expect(series?.name).toBe('pm10');
      expect(series?.unit).toBe('µg/m³');
      expect(series?.points).toEqual([
        { date: '2026-10-12T10:00:00.000Z', value: 20 },
        { date: '2026-10-12T14:00:00.000Z', value: 15 },
      ]);
    });

    it('defaults to first series when name is null', () => {
      const series = pickSeries(observations, null);
      expect(series).not.toBeNull();
      expect(series?.name).toBe('pm10');
    });

    it('returns null when series name is not found or observations empty', () => {
      expect(pickSeries(observations, 'non-existent')).toBeNull();
      expect(pickSeries([], null)).toBeNull();
    });
  });

  describe('pickDistribution', () => {
    const breakdown = [
      { id: 'b1', label: 'Residential', value: 55, group: 'energy', unit: '%' },
      { id: 'b2', label: 'Commercial', value: 35, group: 'energy', unit: '%' },
      { id: 'b3', label: 'Industrial', value: 10, group: 'energy', unit: '%' },
      { id: 'b4', label: 'Cars', value: 60, group: 'mobility', unit: '%' },
    ];

    it('picks explicit group', () => {
      const dist = pickDistribution(breakdown, 'energy');
      expect(dist).not.toBeNull();
      expect(dist?.group).toBe('energy');
      expect(dist?.unit).toBe('%');
      expect(dist?.parts).toEqual([
        { label: 'Residential', value: 55 },
        { label: 'Commercial', value: 35 },
        { label: 'Industrial', value: 10 },
      ]);
    });

    it('defaults to first entry group when group is null', () => {
      const dist = pickDistribution(breakdown, null);
      expect(dist?.group).toBe('energy');
    });

    it('returns null when group not found or entries empty', () => {
      expect(pickDistribution(breakdown, 'unknown')).toBeNull();
      expect(pickDistribution([], null)).toBeNull();
    });
  });
});
