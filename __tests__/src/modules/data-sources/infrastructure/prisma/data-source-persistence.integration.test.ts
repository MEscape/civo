import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import { createDataSourceDraft } from '@modules/data-sources/domain/models/data-source';
import { createDatasetDraft } from '@modules/data-sources/domain/models/dataset';
import { toWebsiteId } from '@modules/data-sources/domain/models/ids';
import type { DataSourceId } from '@modules/data-sources/domain/models/ids';
import { PrismaDataSourceRepository } from '@modules/data-sources/infrastructure/prisma/prisma-data-source.repository';
import { PrismaDatasetRepository } from '@modules/data-sources/infrastructure/prisma/prisma-dataset.repository';

import { db, disconnectDb } from '@lib/db';
import { infrastructureError } from '@lib/errors';
import { fromThrowableAsync, okAsync } from '@lib/result';

/** Uses only its own website fixture; no app server, connector, migration, or external API is started. */
describe('data source persistence (real Postgres)', () => {
  const id = `it-data-sources-${randomUUID()}`;
  const websiteId = toWebsiteId(id);
  const tenantId = toTenantId(id);
  const sources = new PrismaDataSourceRepository();
  const datasets = new PrismaDatasetRepository();

  beforeAll(async () => {
    await db.orm.public.Website.create({
      id,
      tenantId: id,
      slug: id,
      name: 'Data source integration',
      templateKey: 'municipal',
    });
  });
  afterAll(async () => {
    await db.orm.public.Website.where({ id }).deleteAndCount();
    await disconnectDb();
  });

  async function createSource(name: string) {
    const draft = createDataSourceDraft({
      websiteId,
      name,
      kind: 'REST',
      config: { baseUrl: 'https://example.org/api', authMode: 'NONE' },
    })._unsafeUnwrap();
    return (await sources.create({ tenantId, draft }))._unsafeUnwrap();
  }
  async function createDataset(sourceId: DataSourceId, name: string) {
    const draft = createDatasetDraft(sourceId, { name, canonicalKind: 'NewsItem' })._unsafeUnwrap();
    return (await datasets.create({ tenantId, draft }))._unsafeUnwrap();
  }

  it('keeps source position, nested list truncation and website setup consistent', async () => {
    const source = await createSource('Read fixture');
    const dataset = await createDataset(source.id, 'News one');
    await createDataset(source.id, 'News two');
    const page = (
      await sources.listWithDatasets(websiteId, tenantId, {
        page: { page: 1, pageSize: 50 },
        datasetsPerSource: 1,
      })
    )._unsafeUnwrap();
    expect(page.items.find((row) => row.source.id === source.id)?.datasets).toHaveLength(1);
    expect(page.items.find((row) => row.source.id === source.id)?.isDatasetListTruncated).toBe(
      true,
    );
    const position = page.items.findIndex((row) => row.source.id === source.id) + 1;
    expect(
      (
        await sources.pageOfSource({ websiteId, tenantId, sourceId: source.id, pageSize: 1 })
      )._unsafeUnwrap(),
    ).toBe(position);
    await db.orm.public.Dataset.where({ id: dataset.id }).update({
      mapping: { fields: [{ sourcePath: 'title', targetPath: 'title' }] },
    });
    expect((await datasets.getSetup(websiteId, tenantId))._unsafeUnwrap().mappedKinds).toContain(
      'NewsItem',
    );
    expect(
      (await sources.findById(source.id, toTenantId('foreign-website')))._unsafeUnwrap(),
    ).toBeNull();
  });

  it('does not cascade when a child is created while the external usage guard is running', async () => {
    const source = await createSource('Concurrent fixture');
    await createDataset(source.id, 'Before guard');
    let releaseGuard = () => {};
    let announceGuard = () => {};
    const guardReady = new Promise<void>((resolve) => {
      announceGuard = resolve;
    });
    const guardMayFinish = new Promise<void>((resolve) => {
      releaseGuard = resolve;
    });
    const deletion = sources.deleteGuarded(source.id, tenantId, () => {
      announceGuard();
      return fromThrowableAsync(
        () => guardMayFinish,
        (cause) => infrastructureError('test.guard_failed', 'Guard failed.', cause),
      );
    });
    await guardReady;
    try {
      await createDataset(source.id, 'Added during guard');
    } finally {
      releaseGuard();
    }
    expect((await deletion)._unsafeUnwrapErr().code).toBe('data_source.deletion_incomplete');
    expect((await sources.findById(source.id, tenantId))._unsafeUnwrap()).not.toBeNull();
  });

  it('checks stored ids even when their canonical kind cannot be mapped, and deletes checked children atomically', async () => {
    const source = await createSource('Raw child fixture');
    const raw = await db.orm.public.Dataset.select('id').create({
      dataSourceId: source.id,
      name: 'Old kind',
      slug: 'old-kind',
      canonicalKind: 'retired-canonical-kind',
    });
    const checked: string[] = [];
    const removed = (
      await sources.deleteGuarded(source.id, tenantId, ({ datasetIds }) => {
        checked.push(...datasetIds);
        return okAsync(undefined);
      })
    )._unsafeUnwrap();
    expect(checked).toEqual([raw.id]);
    expect(removed).toEqual([raw.id]);
    expect((await sources.findById(source.id, tenantId))._unsafeUnwrap()).toBeNull();
  });
});
