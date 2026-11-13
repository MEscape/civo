import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const pointSchema = z.object({
  timestamp: z.iso.datetime({ offset: true }),
  value: z.number(),
});
const stationSchema = z.object({
  uuid: z.uuid(),
  longname: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timeseries: z.array(
    z.object({
      shortname: z.string(),
      unit: z.string(),
      equidistance: z.number(),
      currentMeasurement: pointSchema.optional(),
    }),
  ),
});
const FIXTURE_ROOT = path.resolve(process.cwd(), 'data/fixtures');
const fixture = async (relative: string): Promise<unknown> =>
  JSON.parse(await readFile(path.join(FIXTURE_ROOT, relative), 'utf8'));

describe('recorded Würzburg source contracts', () => {
  it('contains an actual Würzburg station and a centimetre water-level series', async () => {
    const stations = z.array(stationSchema).parse(await fixture('pegel-main/response.json'));
    const station = stations.find(
      (candidate) => candidate.uuid === '915d76e1-3bf9-4e37-9a9a-4d144cd771cc',
    );
    expect(station?.longname).toBe('WÜRZBURG');
    expect(station?.timeseries.find((series) => series.shortname === 'W')?.unit).toBe('cm');
  });

  it('validates the captured bounded measurement history', async () => {
    const points = z
      .array(pointSchema)
      .min(3)
      .max(1000)
      .parse(await fixture('pegel-wuerzburg-day/response.json'));
    const timestamps = points.map((point) => Date.parse(point.timestamp));
    expect(Math.max(...timestamps) - Math.min(...timestamps)).toBeLessThanOrEqual(86_400_000);
  });

  it('records an honest empty NINA response without inventing alert records', async () => {
    expect(await fixture('nina-wuerzburg/response.json')).toEqual([]);
  });

  it('retains HTTP metadata and the actual terms establishing reuse', async () => {
    const metadata = z
      .object({
        httpStatus: z.literal(200),
        contentType: z.string(),
        fetchedAt: z.iso.datetime(),
        url: z.url(),
      })
      .parse(await fixture('pegel-main/response.meta.json'));
    expect(metadata.contentType).toContain('json');
    const terms = await readFile(path.join(FIXTURE_ROOT, 'pegel-license/response.html'), 'utf8');
    expect(terms).toContain('zero-2-0');
  });
});
