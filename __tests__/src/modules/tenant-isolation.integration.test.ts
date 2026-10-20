/**
 * Integration test of tenant isolation at the data layer, against a real Postgres: whatever a
 * use case does, a repository that is asked for another tenant's row finds nothing, and one that
 * is asked to change it changes nothing. This is the counterpart of `architecture/tenant-scope`
 * (which keeps every query bound to a tenant) for the repositories that have no isolation test of
 * their own. Needs the database of `DATABASE_URL` with the migrations applied:
 * `npm run test:integration`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PLATFORM_AUDIT_SCOPE, websiteAuditScope } from '@modules/audit/domain/models/audit-scope';
import { toWebsiteId as toAuditWebsiteId } from '@modules/audit/domain/models/ids';
import { PrismaAuditTrailRepository } from '@modules/audit/infrastructure/prisma/prisma-audit-trail.repository';
import { toTenantId } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { PageId } from '@modules/builder/domain/models/ids';
import { EMPTY_PAGE_CONFIG, serializePageConfig } from '@modules/builder/domain/models/page-config';
import { PrismaPageRepository } from '@modules/builder/infrastructure/prisma/prisma-page.repository';
import {
  toDataSourceId,
  toDatasetId,
  toWebsiteId as toSourceWebsiteId,
} from '@modules/data-sources/domain/models/ids';
import { PrismaDataSourceRepository } from '@modules/data-sources/infrastructure/prisma/prisma-data-source.repository';
import { PrismaDatasetRepository } from '@modules/data-sources/infrastructure/prisma/prisma-dataset.repository';
import {
  toMigrationId,
  toReleaseId,
  toWebsiteId as toReleaseWebsiteId,
} from '@modules/release/domain/models/ids';
import { PrismaMigrationRepository } from '@modules/release/infrastructure/prisma/prisma-migration.repository';
import { PrismaReleaseRepository } from '@modules/release/infrastructure/prisma/prisma-release.repository';

import { systemClock } from '@lib/clock';
import { dateToInstant, db, disconnectDb } from '@lib/db';

describe('tenant isolation (real Postgres)', () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const siteA = `it-tenancy-a-${suffix}`;
  const siteB = `it-tenancy-b-${suffix}`;
  const tenantA = toTenantId(siteA);
  const tenantB = toTenantId(siteB);

  const pages = new PrismaPageRepository(systemClock);
  const sources = new PrismaDataSourceRepository();
  const datasets = new PrismaDatasetRepository();
  const trail = new PrismaAuditTrailRepository();
  const releases = new PrismaReleaseRepository();
  const migrations = new PrismaMigrationRepository();

  let pageA = '';
  let sourceA = '';
  let datasetA = '';
  let releaseA1 = '';
  let releaseA2 = '';
  let releaseB = '';
  let migrationA = '';

  async function createWebsite(id: string) {
    return db.orm.public.Website.create({
      id,
      tenantId: id,
      name: `Site ${id}`,
      slug: id,
      templateKey: 'civic',
    });
  }

  beforeAll(async () => {
    await createWebsite(siteA);
    await createWebsite(siteB);

    const page = await db.orm.public.Page.select('id').create({
      tenantId: siteA,
      websiteId: siteA,
      path: 'about',
      title: 'About',
    });
    pageA = page.id;
    await db.orm.public.PageConfig.create({
      pageId: pageA,
      version: 1,
      content: serializePageConfig(EMPTY_PAGE_CONFIG),
      status: 'PUBLISHED',
    });

    const source = await db.orm.public.DataSource.select('id').create({
      websiteId: siteA,
      name: 'Source A',
      kind: 'MOCK',
      config: {},
      status: 'UNKNOWN',
    });
    sourceA = source.id;
    const dataset = await db.orm.public.Dataset.select('id').create({
      dataSourceId: sourceA,
      name: 'Dataset A',
      slug: 'dataset-a',
      canonicalKind: 'NewsItem',
      status: 'UNKNOWN',
    });
    datasetA = dataset.id;

    const release = (
      websiteId: string,
      releaseNumber: number,
      status: 'PUBLISHED' | 'ROLLED_BACK',
    ) =>
      db.orm.public.WebsiteRelease.select('id').create({
        websiteId,
        releaseNumber,
        status,
        snapshot: {},
        snapshotHash: 'a'.repeat(64),
        publishedAt: dateToInstant(new Date()),
      });
    releaseA1 = (await release(siteA, 1, 'ROLLED_BACK')).id;
    releaseA2 = (await release(siteA, 2, 'PUBLISHED')).id;
    releaseB = (await release(siteB, 1, 'PUBLISHED')).id;
    await db.orm.public.Website.where({ id: siteA }).update({ publishedReleaseId: releaseA2 });
    await db.orm.public.Website.where({ id: siteB }).update({ publishedReleaseId: releaseB });
    migrationA = (
      await db.orm.public.WebsiteMigration.select('id').create({
        websiteId: siteA,
        sourceReleaseId: releaseA2,
        status: 'PROPOSED',
        plan: { schemaVersion: 1, pages: [] },
        proposedBy: 'someone',
      })
    ).id;

    for (const websiteId of [siteA, siteB]) {
      const appended = await trail.append({
        websiteId: toAuditWebsiteId(websiteId),
        source: 'website',
        type: 'website.created',
        severity: 'info',
        actor: { kind: 'system' },
        details: {},
        occurredAt: new Date(),
      });
      expect(appended.isOk()).toBe(true);
    }
  });

  afterAll(async () => {
    for (const id of [siteA, siteB]) {
      await db.orm.public.AuditEntry.where({ websiteId: id }).deleteAndCount();
      await db.orm.public.Website.where({ id }).deleteAndCount();
    }
    await disconnectDb();
  });

  describe('pages', () => {
    it('are found by their own tenant', async () => {
      const found = await pages.findById(pageA as PageId, tenantA);

      expect(found._unsafeUnwrap()?.id).toBe(pageA);
    });

    it('are not found, read or listed by another tenant', async () => {
      expect((await pages.findById(pageA as PageId, tenantB))._unsafeUnwrap()).toBeNull();
      expect((await pages.findSummaryById(pageA as PageId, tenantB))._unsafeUnwrap()).toBeNull();
      const listed = await pages.listByWebsite(siteA as never, tenantB, { page: 1, pageSize: 25 });
      expect(listed._unsafeUnwrap().total).toBe(0);
      const titles = await pages.findTitles(siteA as never, tenantB, [pageA as PageId]);
      expect(titles._unsafeUnwrap()).toEqual([]);
    });

    it('cannot be saved by another tenant, and are left as they were', async () => {
      const result = await pages.saveConfig({
        id: pageA as PageId,
        tenantId: tenantB,
        config: EMPTY_PAGE_CONFIG,
        expectedVersion: 1,
      });

      expect(result._unsafeUnwrapErr().kind).toBe('not_found');
      const stored = await db.orm.public.Page.where({ id: pageA }).select('version').first();
      expect(stored?.version).toBe(1);
    });

    it('cannot be created in another tenant’s website', async () => {
      const result = await pages.create({
        tenantId: tenantB,
        draft: {
          websiteId: siteA as never,
          path: 'intruder',
          title: 'Intruder',
          config: EMPTY_PAGE_CONFIG,
        },
      });

      expect(result._unsafeUnwrapErr().kind).toBe('not_found');
      const intruders = await db.orm.public.Page.where({
        websiteId: siteA,
        path: 'intruder',
      }).all();
      expect(intruders).toEqual([]);
    });
  });

  describe('data sources and their datasets', () => {
    it('are found by their own tenant', async () => {
      const source = await sources.findById(toDataSourceId(sourceA), tenantA);
      expect(source._unsafeUnwrap(), 'the source').not.toBeNull();
      const dataset = await datasets.findWithSource(toDatasetId(datasetA), tenantA);
      expect(dataset._unsafeUnwrap(), 'the dataset').not.toBeNull();
    });

    it('are not found, listed or named for another tenant', async () => {
      expect((await sources.findById(toDataSourceId(sourceA), tenantB))._unsafeUnwrap()).toBeNull();
      expect(
        (await sources.listByWebsite(toSourceWebsiteId(siteA), tenantB, 50))._unsafeUnwrap(),
      ).toEqual([]);
      expect(
        (
          await sources.findNames(toSourceWebsiteId(siteA), tenantB, [toDataSourceId(sourceA)])
        )._unsafeUnwrap(),
      ).toEqual([]);
      expect(
        (await datasets.findWithSource(toDatasetId(datasetA), tenantB))._unsafeUnwrap(),
      ).toBeNull();
      expect(
        (await datasets.listByDataSource(toDataSourceId(sourceA), tenantB, 50))._unsafeUnwrap(),
      ).toEqual([]);
    });

    it('cannot be changed, tested or deleted by another tenant', async () => {
      const tested = await sources.recordTestResult(toDataSourceId(sourceA), tenantB, {
        status: 'OK',
        error: null,
        checkedAt: new Date(),
      } as never);
      expect(tested._unsafeUnwrapErr().kind).toBe('not_found');

      await sources.deleteById(toDataSourceId(sourceA), tenantB);
      await datasets.deleteById(toDatasetId(datasetA), tenantB);

      expect(await db.orm.public.DataSource.where({ id: sourceA }).first()).not.toBeNull();
      expect(await db.orm.public.Dataset.where({ id: datasetA }).first()).not.toBeNull();
    });

    it('cannot get a dataset created under another tenant’s source', async () => {
      const result = await datasets.create({
        tenantId: tenantB,
        draft: {
          dataSourceId: toDataSourceId(sourceA),
          name: 'Intruder',
          slug: 'intruder',
          canonicalKind: 'NewsItem',
          path: null,
        } as never,
      });

      expect(result._unsafeUnwrapErr().kind).toBe('not_found');
      expect(await db.orm.public.Dataset.where({ slug: 'intruder' }).first()).toBeNull();
    });
  });

  describe('releases and their migrations', () => {
    it('are found and listed by their own website', async () => {
      const history = await releases.findHistory(toReleaseWebsiteId(siteA), {
        page: 1,
        pageSize: 25,
      });
      expect(history._unsafeUnwrap().total).toBe(2);
      const migration = await migrations.findById(
        toReleaseWebsiteId(siteA),
        toMigrationId(migrationA),
      );
      expect(migration._unsafeUnwrap(), 'the migration').not.toBeNull();
    });

    it('are not found or listed through another website', async () => {
      const foreign = await releases.findById(toReleaseWebsiteId(siteB), toReleaseId(releaseA1));
      expect(foreign._unsafeUnwrap()).toBeNull();
      const history = await releases.findHistory(toReleaseWebsiteId(siteB), {
        page: 1,
        pageSize: 25,
      });
      expect(history._unsafeUnwrap().total).toBe(1);
      const migration = await migrations.findById(
        toReleaseWebsiteId(siteB),
        toMigrationId(migrationA),
      );
      expect(migration._unsafeUnwrap()).toBeNull();
      const listed = await migrations.listByWebsite(toReleaseWebsiteId(siteB), {
        page: 1,
        pageSize: 25,
      });
      expect(listed._unsafeUnwrap().total).toBe(0);
    });

    it('cannot be activated through another website, and the live release stays live', async () => {
      const result = await releases.activate({
        websiteId: toReleaseWebsiteId(siteB),
        releaseId: toReleaseId(releaseA1),
      });

      expect(result._unsafeUnwrapErr().kind).toBe('not_found');
      const live = await db.orm.public.WebsiteRelease.where({ id: releaseB })
        .select('status')
        .first();
      expect(live?.status, 'the live release of the asking website').toBe('PUBLISHED');
      const stored = await db.orm.public.WebsiteRelease.where({ id: releaseA1 })
        .select('status')
        .first();
      expect(stored?.status, 'the release of the other website').toBe('ROLLED_BACK');
    });

    it('are activated by their own website, which rolls the previous one back', async () => {
      const result = await releases.activate({
        websiteId: toReleaseWebsiteId(siteA),
        releaseId: toReleaseId(releaseA1),
      });

      expect(result.isOk()).toBe(true);
      const status = async (id: string) =>
        (await db.orm.public.WebsiteRelease.where({ id }).select('status').first())?.status;
      expect(await status(releaseA1)).toBe('PUBLISHED');
      expect(await status(releaseA2)).toBe('ROLLED_BACK');
    });

    it('cannot have a migration applied through another website', async () => {
      const result = await migrations.markApplied({
        id: toMigrationId(migrationA),
        websiteId: toReleaseWebsiteId(siteB),
        appliedBy: toActorId('someone'),
        appliedAt: new Date(),
        resolutions: {},
      });

      expect(result.isErr()).toBe(true);
      const stored = await db.orm.public.WebsiteMigration.where({ id: migrationA })
        .select('status')
        .first();
      expect(stored?.status).toBe('PROPOSED');
    });

    it('cannot publish a migration source from another website', async () => {
      const result = await migrations.create({
        websiteId: toReleaseWebsiteId(siteB),
        sourceReleaseId: toReleaseId(releaseA2),
        proposedBy: toActorId('someone'),
        plan: { pages: [] },
      });

      expect(result.isErr(), 'the database refuses a source of another website').toBe(true);
    });
  });

  describe('the audit trail', () => {
    const criteria = { source: null, type: null, actor: null, since: null, onlyWarnings: false };
    const page = { page: 1, pageSize: 100 };

    it('reads only the website it is asked about', async () => {
      const own = (
        await trail.list(websiteAuditScope(toAuditWebsiteId(siteA)), criteria, page)
      )._unsafeUnwrap();

      expect(own.items.length).toBeGreaterThan(0);
      expect(own.items.every((entry) => entry.websiteId === siteA)).toBe(true);
    });

    it('reads every website only when asked for the platform’s scope, and then reads both', async () => {
      const everyone = (await trail.list(PLATFORM_AUDIT_SCOPE, criteria, page))._unsafeUnwrap();
      const websites = new Set(everyone.items.map((entry) => entry.websiteId));

      expect(websites.has(toAuditWebsiteId(siteA))).toBe(true);
      expect(websites.has(toAuditWebsiteId(siteB))).toBe(true);
    });

    it('counts the types of one website without the other’s', async () => {
      const own = (
        await trail.countByType(websiteAuditScope(toAuditWebsiteId(siteB)), criteria, 50)
      )._unsafeUnwrap();

      expect(own.find((entry) => entry.type === 'website.created')?.count).toBe(1);
    });
  });

  it('keeps the two tenants apart in the database itself', async () => {
    const pageOfA = await db.orm.public.Page.where({ id: pageA }).select('tenantId').first();
    expect(pageOfA?.tenantId).toBe(siteA);
    expect(dateToInstant(new Date())).toBeDefined();
  });
});
