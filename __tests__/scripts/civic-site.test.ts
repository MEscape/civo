import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));

describe('citizen site source integrity', () => {
  it('gives the reference website an id the tenancy reads from a website path', async () => {
    const { isWebsiteId } = await import('@lib/tenancy/tenant-hint');
    const { WUERZBURG_WEBSITE_ID } = await import('../../prisma/seed/wuerzburg-manifest');
    const manifest = (await read('data/seeds/wuerzburg.json')) as { websiteId: string };
    const ingest = (await read('data/sources/wuerzburg.ingest.json')) as { websiteId: string };

    expect(isWebsiteId(WUERZBURG_WEBSITE_ID)).toBe(true);
    expect(manifest.websiteId).toBe(WUERZBURG_WEBSITE_ID);
    expect(ingest.websiteId).toBe(WUERZBURG_WEBSITE_ID);
  });

  it('keeps the public sitemap focused and excludes fabricated source records', async () => {
    const { z } = await import('zod');
    const manifest = z
      .object({
        pages: z.array(z.object({ path: z.string(), config: z.unknown() })),
        sources: z.array(
          z.object({
            config: z.object({
              provenance: z.object({ kind: z.literal('snapshot') }),
              records: z.array(z.unknown()),
            }),
          }),
        ),
      })
      .parse(await read('data/seeds/wuerzburg.json'));
    expect(manifest.pages.length).toBeLessThanOrEqual(13);
    expect(manifest.pages.map((page) => page.path)).not.toContain('karten');
    expect(manifest.pages.some((page) => page.path.startsWith('open-data'))).toBe(false);
    expect(manifest.sources.every((source) => source.config.records.length > 0)).toBe(true);
    const booking = manifest.pages.find((page) => page.path === 'buergerservice/termine');
    expect(JSON.stringify(booking?.config)).toContain(
      'https://www.wuerzburg.de/rathaus/buergerbuero/terminvereinbarung',
    );
    expect(JSON.stringify(booking?.config)).not.toContain('"type":"booking"');
  });

  it('retains all city districts but identifies bounded tree and bicycle-place windows', async () => {
    const { z } = await import('zod');
    const response = z.object({ total_count: z.number(), results: z.array(z.unknown()) });
    const districts = response.parse(
      await read('data/fixtures/city-window-stadtbezirke/response.json'),
    );
    expect(districts.results).toHaveLength(districts.total_count);
    const trees = response.parse(
      await read('data/fixtures/city-window-baumkataster_stadt_wuerzburg/response.json'),
    );
    expect(trees.results).toHaveLength(100);
    expect(trees.total_count).toBeGreaterThan(trees.results.length);
  });
});
