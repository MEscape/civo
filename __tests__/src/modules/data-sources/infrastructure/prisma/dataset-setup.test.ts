import { describe, expect, it, vi } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import { MAX_SETUP_MAPPINGS } from '@modules/data-sources/application/data-sources-limits';
import { toWebsiteId } from '@modules/data-sources/domain/models/ids';
import { PrismaDatasetRepository } from '@modules/data-sources/infrastructure/prisma/prisma-dataset.repository';

import type * as LibDb from '@lib/db';

const state = vi.hoisted(() => ({
  mappings: [] as Array<{ canonicalKind: string; mapping: unknown }>,
}));
vi.mock('@lib/db', async (original) => {
  const actual = await original<typeof LibDb>();
  const query = {
    where: () => query,
    select: () => query,
    orderBy: () => query,
    limit: () => query,
    groupBy: () => query,
    aggregate: async () => [{ canonicalKind: 'NewsItem', count: state.mappings.length }],
    all: async () => state.mappings,
  };
  return { ...actual, db: { orm: { public: { Dataset: query } } } };
});

describe('whole-website dataset setup', () => {
  it('does not count non-null but invalid mapping JSON as ready', async () => {
    state.mappings = [
      {
        canonicalKind: 'NewsItem',
        mapping: { fields: [{ sourcePath: 'title', targetPath: 'removed-target' }] },
      },
    ];
    const view = (
      await new PrismaDatasetRepository().getSetup(
        toWebsiteId('website-1'),
        toTenantId('website-1'),
      )
    )._unsafeUnwrap();
    expect(view.kinds).toEqual(['NewsItem']);
    expect(view.mappedKinds).toEqual([]);
    expect(view.isTruncated).toBe(false);
  });

  it('reports bounded scanning while retaining valid mapped kinds', async () => {
    state.mappings = Array.from({ length: MAX_SETUP_MAPPINGS + 1 }, () => ({
      canonicalKind: 'NewsItem',
      mapping: { fields: [{ sourcePath: 'title', targetPath: 'title' }] },
    }));
    const view = (
      await new PrismaDatasetRepository().getSetup(
        toWebsiteId('website-1'),
        toTenantId('website-1'),
      )
    )._unsafeUnwrap();
    expect(view.mappedKinds).toEqual(['NewsItem']);
    expect(view.isTruncated).toBe(true);
  });
});
