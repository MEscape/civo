// @vitest-environment node
/**
 * Proves the media persistence against a REAL Postgres: the migration's constraints, the
 * tenant-scoped repository, the conditional finalisation, and the "is this file still used"
 * search over page content and releases. Point `BOOKING_TEST_DATABASE_URL` at a database with
 * the migrations applied and run `npm run test:integration`; without it every test is skipped
 * and reported as skipped.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import type { TenantId } from '@modules/auth';
import { toMediaAssetId } from '@modules/media/domain/models/ids';
import type { NewPendingAsset } from '@modules/media/domain/ports/media-asset.repository';
import { PrismaMediaAssetRepository } from '@modules/media/infrastructure/prisma/prisma-media-asset.repository';
import { PrismaMediaUsageRepository } from '@modules/media/infrastructure/prisma/prisma-media-usage.repository';
import { createWebsiteDraft } from '@modules/website/domain/models/website';
import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import { PrismaWebsiteRepository } from '@modules/website/infrastructure/prisma/prisma-website.repository';

import { dateToInstant, db, disconnectDb } from '@lib/db';

const enabled = process.env['BOOKING_TEST_DATABASE_URL'] !== undefined;
const MINUTE = 60_000;
/** Test content is plain data; the column is Json. */
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as never;

describe.skipIf(!enabled)('media persistence (real Postgres)', () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const assets = new PrismaMediaAssetRepository();
  const usage = new PrismaMediaUsageRepository();
  const websites = new PrismaWebsiteRepository();
  const slugs = [`media-a-${suffix}`, `media-b-${suffix}`];
  let a: TenantId;
  let b: TenantId;

  /** A quota nothing in these tests comes near. */
  const roomy = () => ({ now: new Date(), maxOpen: 1000 });

  const pending = (
    tenantId: TenantId,
    overrides: Partial<NewPendingAsset> = {},
  ): NewPendingAsset => ({
    tenantId,
    createdBy: 'actor-1',
    originalFilename: 'photo.png',
    contentType: 'image/png',
    byteSize: 1234,
    visibility: 'public',
    uploadExpiresAt: new Date(Date.now() + 15 * MINUTE),
    ...overrides,
  });

  beforeAll(async () => {
    const ids: TenantId[] = [];
    for (const slug of slugs) {
      const draft = createWebsiteDraft({
        name: slug,
        slug,
        description: null,
        templateKey: 'municipal',
      })._unsafeUnwrap();
      const created = (
        await websites.create({ draft, theme: DEFAULT_WEBSITE_THEME })
      )._unsafeUnwrap();
      ids.push(toTenantId(created.id));
    }
    [a, b] = ids as [TenantId, TenantId];
  });

  afterAll(async () => {
    for (const slug of slugs) {
      await db.orm.public.Website.where({ slug }).deleteAndCount();
    }
    await disconnectDb();
  });

  describe('the repository', () => {
    it('stores a PENDING asset whose key comes from the tenant and the minted id', async () => {
      const asset = (
        await assets.createPending(pending(a, { originalFilename: '../../evil.png' }), roomy())
      )._unsafeUnwrap();

      expect(asset).toMatchObject({
        tenantId: a,
        status: 'pending',
        visibility: 'public',
        byteSize: 1234,
      });
      expect(asset.objectKey).toBe(`sites/${a}/media/${asset.id}`);
      expect(asset.objectKey).not.toContain('evil');
    });

    it("never shows one website's file to another", async () => {
      const mine = (await assets.createPending(pending(a), roomy()))._unsafeUnwrap();

      expect((await assets.findById(mine.id, a))._unsafeUnwrap()?.id).toBe(mine.id);
      expect((await assets.findById(mine.id, b))._unsafeUnwrap()).toBeNull();
      expect((await assets.markReady(mine.id, b, new Date()))._unsafeUnwrap()).toBeNull();
      expect((await assets.markDeleting(mine.id, b, new Date()))._unsafeUnwrap()).toBeNull();
      await assets.deleteById(mine.id, b);
      expect((await assets.findById(mine.id, a))._unsafeUnwrap()).not.toBeNull();
    });

    it('lets exactly one of two simultaneous finalisations win', async () => {
      const asset = (await assets.createPending(pending(a), roomy()))._unsafeUnwrap();
      const results = await Promise.all([
        assets.markReady(asset.id, a, new Date()),
        assets.markReady(asset.id, a, new Date()),
        assets.markReady(asset.id, a, new Date()),
      ]);

      const winners = results.filter((result) => result._unsafeUnwrap() !== null);
      expect(winners).toHaveLength(1);
      expect((await assets.findById(asset.id, a))._unsafeUnwrap()?.status).toBe('ready');
    });

    it('does not finalise something that is being deleted', async () => {
      const asset = (await assets.createPending(pending(a), roomy()))._unsafeUnwrap();
      await assets.markDeleting(asset.id, a, new Date());
      expect((await assets.markReady(asset.id, a, new Date()))._unsafeUnwrap()).toBeNull();
    });

    it('refuses an upload once the quota of live uploads is used, and counts only live ones', async () => {
      const lonely = toTenantId((await createTenant(`count-${suffix}`)).id);
      const quota = { now: new Date(), maxOpen: 2 };
      await assets.createPending(pending(lonely), quota);
      // Expired: it no longer counts against the quota.
      await assets.createPending(
        pending(lonely, { uploadExpiresAt: new Date(Date.now() - MINUTE) }),
        quota,
      );
      const finished = (await assets.createPending(pending(lonely), quota))._unsafeUnwrap();
      await assets.markReady(finished.id, lonely, new Date());
      await assets.createPending(pending(lonely), quota);

      expect((await assets.createPending(pending(lonely), quota))._unsafeUnwrapErr().code).toBe(
        'media.too_many_pending',
      );
      await db.orm.public.Website.where({ id: lonely }).deleteAndCount();
    });

    it('cannot exceed the quota with simultaneous requests', async () => {
      const busy = toTenantId((await createTenant(`quota-${suffix}`)).id);
      const quota = { now: new Date(), maxOpen: 2 };
      const results = await Promise.all(
        Array.from({ length: 6 }, () => assets.createPending(pending(busy), quota)),
      );

      expect(results.filter((result) => result.isOk())).toHaveLength(2);
      await db.orm.public.Website.where({ id: busy }).deleteAndCount();
    });

    it('lists only finished files of the website, newest first, in stable pages', async () => {
      const owner = toTenantId((await createTenant(`list-${suffix}`)).id);
      const created = [];
      for (let i = 0; i < 3; i += 1) {
        const asset = (await assets.createPending(pending(owner), roomy()))._unsafeUnwrap();
        await assets.markReady(asset.id, owner, new Date());
        created.push(asset.id);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await assets.createPending(pending(owner), roomy()); // still pending: not listed
      const deleting = (await assets.createPending(pending(owner), roomy()))._unsafeUnwrap();
      await assets.markReady(deleting.id, owner, new Date());
      await assets.markDeleting(deleting.id, owner, new Date()); // on its way out: not listed

      const first = (await assets.listReady(owner, { page: 1, pageSize: 2 }))._unsafeUnwrap();
      const second = (await assets.listReady(owner, { page: 2, pageSize: 2 }))._unsafeUnwrap();

      expect([first.total, first.pageCount, first.items.length, second.items.length]).toEqual([
        3, 2, 2, 1,
      ]);
      expect([...first.items, ...second.items].map((item) => item.id)).toEqual(
        [...created].reverse(),
      );
      await db.orm.public.Website.where({ id: owner }).deleteAndCount();
    });

    it('finds files by a literal part of their name and orders them by name', async () => {
      const owner = toTenantId((await createTenant(`search-${suffix}`)).id);
      for (const originalFilename of ['Town_hall.png', 'park.png', 'townsquare.png']) {
        const asset = (
          await assets.createPending(pending(owner, { originalFilename }), roomy())
        )._unsafeUnwrap();
        await assets.markReady(asset.id, owner, new Date());
      }
      const names = async (search: string) =>
        (
          await assets.listReady(
            owner,
            { page: 1, pageSize: 10 },
            { search, sort: { field: 'name', direction: 'desc' } },
          )
        )
          ._unsafeUnwrap()
          .items.map((item) => item.originalFilename);

      expect(await names('TOWN')).toHaveLength(2);
      expect(await names('n_h')).toEqual(['Town_hall.png']);
      expect(await names('%')).toEqual([]);
      await db.orm.public.Website.where({ id: owner }).deleteAndCount();
    });

    it('deletes idempotently', async () => {
      const asset = (await assets.createPending(pending(a), roomy()))._unsafeUnwrap();
      expect((await assets.deleteById(asset.id, a)).isOk()).toBe(true);
      expect((await assets.deleteById(asset.id, a)).isOk()).toBe(true);
      expect((await assets.findById(asset.id, a))._unsafeUnwrap()).toBeNull();
    });

    it('reports a stored value it does not understand as a failure, not as data', async () => {
      const id = randomUUID();
      await db.orm.public.MediaAsset.create({
        id,
        tenantId: a,
        websiteId: a,
        objectKey: `sites/${a}/media/${id}`,
        originalFilename: 'x.html',
        contentType: 'text/html',
        byteSize: 5,
        visibility: 'PUBLIC',
        status: 'READY',
        createdBy: 'someone',
        uploadExpiresAt: dateToInstant(new Date()),
      });

      const found = await assets.findById(toMediaAssetId(id), a);
      expect(found._unsafeUnwrapErr().code).toBe('media.persistence_failed');
    });
  });

  describe('claiming abandoned uploads', () => {
    const past = (minutes: number) => new Date(Date.now() - minutes * MINUTE);
    const lease = () => past(15);
    const idsOf = (claimed: ReadonlyArray<{ id: string }>) =>
      claimed.map((asset) => asset.id).sort();

    it('claims an expired upload and marks it for removal, and nothing else', async () => {
      const owner = toTenantId((await createTenant(`claim-${suffix}`)).id);
      const expired = (
        await assets.createPending(pending(owner, { uploadExpiresAt: past(1) }), roomy())
      )._unsafeUnwrap();
      const fresh = (await assets.createPending(pending(owner), roomy()))._unsafeUnwrap();
      const finished = (
        await assets.createPending(pending(owner, { uploadExpiresAt: past(1) }), roomy())
      )._unsafeUnwrap();
      await assets.markReady(finished.id, owner, new Date());
      const recentDeletion = (await assets.createPending(pending(owner), roomy()))._unsafeUnwrap();
      await assets.markDeleting(recentDeletion.id, owner, new Date());

      const claimed = (
        await assets.claimAbandoned({
          tenantId: owner,
          now: new Date(),
          staleBefore: lease(),
          limit: 10,
        })
      )._unsafeUnwrap();

      expect(idsOf(claimed)).toEqual([expired.id]);
      expect(claimed[0]?.status).toBe('deleting');
      expect((await assets.findById(fresh.id, owner))._unsafeUnwrap()?.status).toBe('pending');
      expect((await assets.findById(finished.id, owner))._unsafeUnwrap()?.status).toBe('ready');
      expect((await assets.findById(recentDeletion.id, owner))._unsafeUnwrap()?.status).toBe(
        'deleting',
      );
      await db.orm.public.Website.where({ id: owner }).deleteAndCount();
    });

    it('takes up a deletion that stalled for longer than its lease', async () => {
      const owner = toTenantId((await createTenant(`stale-${suffix}`)).id);
      const stalled = (await assets.createPending(pending(owner), roomy()))._unsafeUnwrap();
      await assets.markDeleting(stalled.id, owner, past(30));

      expect(
        idsOf(
          (
            await assets.claimAbandoned({
              tenantId: owner,
              now: new Date(),
              staleBefore: lease(),
              limit: 10,
            })
          )._unsafeUnwrap(),
        ),
      ).toEqual([stalled.id]);
      await db.orm.public.Website.where({ id: owner }).deleteAndCount();
    });

    it("never claims another website's files", async () => {
      const mine = toTenantId((await createTenant(`mine-${suffix}`)).id);
      const theirs = toTenantId((await createTenant(`theirs-${suffix}`)).id);
      const foreign = (
        await assets.createPending(pending(theirs, { uploadExpiresAt: past(5) }), roomy())
      )._unsafeUnwrap();

      expect(
        (
          await assets.claimAbandoned({
            tenantId: mine,
            now: new Date(),
            staleBefore: lease(),
            limit: 10,
          })
        )._unsafeUnwrap(),
      ).toEqual([]);
      expect((await assets.findById(foreign.id, theirs))._unsafeUnwrap()?.status).toBe('pending');
      for (const id of [mine, theirs]) {
        await db.orm.public.Website.where({ id }).deleteAndCount();
      }
    });

    it('claims at most the limit, oldest first', async () => {
      const owner = toTenantId((await createTenant(`limit-${suffix}`)).id);
      const created = [];
      for (let i = 0; i < 4; i += 1) {
        created.push(
          (
            await assets.createPending(pending(owner, { uploadExpiresAt: past(5) }), roomy())
          )._unsafeUnwrap().id,
        );
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const claimed = (
        await assets.claimAbandoned({
          tenantId: owner,
          now: new Date(),
          staleBefore: lease(),
          limit: 2,
        })
      )._unsafeUnwrap();
      expect(claimed.map((asset) => asset.id)).toEqual(created.slice(0, 2));
      await db.orm.public.Website.where({ id: owner }).deleteAndCount();
    });

    it('never hands the same file to two simultaneous sweeps', async () => {
      const owner = toTenantId((await createTenant(`race-${suffix}`)).id);
      for (let i = 0; i < 12; i += 1) {
        await assets.createPending(pending(owner, { uploadExpiresAt: past(5) }), roomy());
      }

      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          assets.claimAbandoned({
            tenantId: owner,
            now: new Date(),
            staleBefore: lease(),
            limit: 5,
          }),
        ),
      );
      const all = results.flatMap((result) => result._unsafeUnwrap().map((asset) => asset.id));

      expect(new Set(all).size).toBe(all.length);
      expect(all).toHaveLength(12);
      await db.orm.public.Website.where({ id: owner }).deleteAndCount();
    });
  });

  describe('what the table itself refuses', () => {
    const row = (tenantId: string, websiteId: string, overrides: Record<string, unknown> = {}) => {
      const id = randomUUID();
      return {
        id,
        tenantId,
        websiteId,
        objectKey: `sites/${tenantId}/media/${id}`,
        originalFilename: 'x.png',
        contentType: 'image/png',
        byteSize: 10,
        visibility: 'PUBLIC' as const,
        status: 'PENDING' as const,
        createdBy: 'someone',
        uploadExpiresAt: dateToInstant(new Date()),
        ...overrides,
      };
    };

    it('an empty file', async () => {
      await expect(db.orm.public.MediaAsset.create(row(a, a, { byteSize: 0 }))).rejects.toThrow();
    });

    it('a file filed under a website that is not the tenant', async () => {
      await expect(db.orm.public.MediaAsset.create(row(b, a))).rejects.toThrow();
    });

    it('a file of a website that does not exist', async () => {
      const ghost = randomUUID();
      await expect(db.orm.public.MediaAsset.create(row(ghost, ghost))).rejects.toThrow();
    });

    it('two files claiming one object key', async () => {
      const first = row(a, a);
      await db.orm.public.MediaAsset.create(first);
      await expect(
        db.orm.public.MediaAsset.create(row(a, a, { objectKey: first.objectKey })),
      ).rejects.toThrow();
    });

    it('a status or visibility outside the vocabulary', async () => {
      await expect(
        db.orm.public.MediaAsset.create(row(a, a, { status: 'HIDDEN' })),
      ).rejects.toThrow();
      await expect(
        db.orm.public.MediaAsset.create(row(a, a, { visibility: 'SECRET' })),
      ).rejects.toThrow();
    });

    it('removes the rows with their website, which is why deleting a website must also clear its objects', async () => {
      const doomed = toTenantId((await createTenant(`doomed-${suffix}`)).id);
      const asset = (await assets.createPending(pending(doomed), roomy()))._unsafeUnwrap();
      await db.orm.public.Website.where({ id: doomed }).deleteAndCount();
      expect((await assets.findById(asset.id, doomed))._unsafeUnwrap()).toBeNull();
    });
  });

  describe('the "still in use" search', () => {
    const assetId = () => toMediaAssetId(randomUUID());
    const withPage = async (tenantId: TenantId, versions: unknown[]) => {
      const page = await db.orm.public.Page.create({
        tenantId,
        websiteId: tenantId,
        path: `p-${randomUUID().slice(0, 8)}`,
        title: 'Page',
      });
      for (const [index, content] of versions.entries()) {
        await db.orm.public.PageConfig.create({
          pageId: page.id,
          content: json(content),
          version: index + 1,
        });
      }
    };
    const release = async (tenantId: TenantId, snapshot: unknown, releaseNumber: number) =>
      db.orm.public.WebsiteRelease.create({
        websiteId: tenantId,
        releaseNumber,
        snapshot: json(snapshot),
        // A SHA-256 hex digest, as the table requires: 64 hex characters.
        snapshotHash: randomUUID().replaceAll('-', '').repeat(2),
      });

    it('finds a file in the newest version of a page', async () => {
      const id = assetId();
      await withPage(a, [{ children: [] }, { children: [{ props: { image: { assetId: id } } }] }]);
      expect((await usage.isReferenced(a, id))._unsafeUnwrap()).toBe(true);
    });

    it('does not count a file that only an older, superseded version used', async () => {
      const id = assetId();
      await withPage(a, [{ children: [{ props: { image: { assetId: id } } }] }, { children: [] }]);
      expect((await usage.isReferenced(a, id))._unsafeUnwrap()).toBe(false);
    });

    it('finds a file in any release, since a rollback restores each of them', async () => {
      const id = assetId();
      await release(
        a,
        { pages: [{ content: { hero: id } }] },
        9000 + Math.floor(Math.random() * 900),
      );
      expect((await usage.isReferenced(a, id))._unsafeUnwrap()).toBe(true);
    });

    it("never counts another website's pages or releases", async () => {
      const id = assetId();
      await withPage(b, [{ children: [{ props: { image: { assetId: id } } }] }]);
      await release(b, { pages: [id] }, 1);
      expect((await usage.isReferenced(a, id))._unsafeUnwrap()).toBe(false);
    });

    it('says no for a file nothing mentions', async () => {
      expect((await usage.isReferenced(a, assetId()))._unsafeUnwrap()).toBe(false);
    });
  });

  async function createTenant(slug: string) {
    const draft = createWebsiteDraft({
      name: slug,
      slug,
      description: null,
      templateKey: 'municipal',
    })._unsafeUnwrap();
    return (await websites.create({ draft, theme: DEFAULT_WEBSITE_THEME }))._unsafeUnwrap();
  }
});
