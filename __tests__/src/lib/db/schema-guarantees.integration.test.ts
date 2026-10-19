/**
 * Integration test of what the database itself guarantees, whatever writes to it: tenant
 * boundaries between tables, immutable releases, an append-only audit trail and a stamped
 * `updatedAt`. Needs the database of `DATABASE_URL` (see `vitest.integration.config.ts`) with the migrations
 * applied: `npm run test:integration`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dateToInstant, db, disconnectDb, instantToDate } from '@lib/db';

const HASH = 'a'.repeat(64);

describe('schema guarantees (real Postgres)', () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const siteA = `it-schema-a-${suffix}`;
  const siteB = `it-schema-b-${suffix}`;

  async function createWebsite(id: string) {
    // A tenant is its website: the one id serves as both.
    return db.orm.public.Website.create({
      id,
      tenantId: id,
      name: `Site ${id}`,
      slug: id,
      templateKey: 'civic',
    });
  }

  function createRelease(websiteId: string, releaseNumber = 1) {
    return db.orm.public.WebsiteRelease.select('id').create({
      websiteId,
      releaseNumber,
      status: 'PUBLISHED',
      snapshot: { pages: [] },
      snapshotHash: HASH,
      publishedAt: dateToInstant(new Date()),
    });
  }

  beforeAll(async () => {
    await createWebsite(siteA);
    await createWebsite(siteB);
  });

  afterAll(async () => {
    for (const id of [siteA, siteB]) {
      await db.orm.public.Website.where({ id }).update({ publishedReleaseId: null });
      await db.orm.public.Website.where({ id }).deleteAndCount();
    }
    await disconnectDb();
  });

  it('refuses a live release that belongs to another website', async () => {
    const release = await createRelease(siteB);

    await expect(
      db.orm.public.Website.where({ id: siteA }).update({ publishedReleaseId: release.id }),
    ).rejects.toThrow(/Website_publishedReleaseId_id_fkey/);
    await expect(
      db.orm.public.Website.where({ id: siteB }).update({ publishedReleaseId: release.id }),
    ).resolves.not.toBeNull();
  });

  it('refuses a resource at a location of another website', async () => {
    const location = await db.orm.public.BookingLocation.select('id').create({
      tenantId: siteA,
      websiteId: siteA,
      name: 'Town hall',
      timeZone: 'UTC',
      openingHours: {},
    });
    const resource = (websiteId: string) =>
      db.orm.public.BookableResource.create({
        tenantId: websiteId,
        websiteId,
        locationId: location.id,
        name: 'Desk',
        type: 'service-desk',
        skills: [],
      });

    await expect(resource(siteB)).rejects.toThrow(/BookableResource_locationId_websiteId_fkey/);
    await expect(resource(siteA)).resolves.toBeDefined();
  });

  it('keeps a release immutable while its status can move', async () => {
    const release = await createRelease(siteA, 2);
    const where = { id: release.id };

    await expect(
      db.orm.public.WebsiteRelease.where(where).update({ snapshot: { pages: ['x'] } }),
    ).rejects.toThrow(/immutable/);
    await expect(
      db.orm.public.WebsiteRelease.where(where).update({ status: 'ROLLED_BACK' }),
    ).resolves.not.toBeNull();
  });

  it('keeps the audit trail append-only', async () => {
    const entry = await db.orm.public.AuditEntry.select('id').create({
      websiteId: siteA,
      source: 'test',
      type: 'test.happened',
      severity: 'INFO',
      actorKind: 'SYSTEM',
      details: {},
      occurredAt: dateToInstant(new Date()),
    });

    await expect(
      db.orm.public.AuditEntry.where({ id: entry.id }).update({ details: { changed: true } }),
    ).rejects.toThrow(/append-only/);
    expect(await db.orm.public.AuditEntry.where({ id: entry.id }).deleteAndCount()).toBe(1);
  });

  it('stamps updatedAt on an update that leaves it alone', async () => {
    const before = await db.orm.public.Website.where({ id: siteB }).select('updatedAt').first();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const after = await db.orm.public.Website.where({ id: siteB })
      .select('updatedAt')
      .update({ description: 'changed' });

    expect(instantToDate(after!.updatedAt).getTime()).toBeGreaterThan(
      instantToDate(before!.updatedAt).getTime(),
    );
  });

  it('deletes a website together with its live release and everything below it', async () => {
    const id = `it-schema-gone-${suffix}`;
    await createWebsite(id);
    const release = await createRelease(id);
    await db.orm.public.Website.where({ id }).update({ publishedReleaseId: release.id });

    expect(await db.orm.public.Website.where({ id }).deleteAndCount()).toBe(1);
    expect(
      await db.orm.public.WebsiteRelease.where({ websiteId: id }).select('id').first(),
    ).toBeNull();
  });
});
