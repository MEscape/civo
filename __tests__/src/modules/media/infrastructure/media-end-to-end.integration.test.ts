// @vitest-environment node
/**
 * The whole upload flow with nothing faked except the signed-in person: the real use cases, a
 * real Postgres, and a real S3-compatible store reached the way a browser reaches it (a plain
 * PUT with the signed headers). Needs BOTH `BOOKING_TEST_DATABASE_URL` and the
 * `STORAGE_TEST_S3_*` variables of `s3-object-store.integration.test.ts`; without them it is
 * skipped and reported as skipped.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import { CompleteMediaUpload } from '@modules/media/application/commands/complete-media-upload';
import { DeleteMediaAsset } from '@modules/media/application/commands/delete-media-asset';
import { RequestMediaUpload } from '@modules/media/application/commands/request-media-upload';
import type { RequestedUpload } from '@modules/media/application/contracts/media-views';
import type { MediaDependencies } from '@modules/media/application/media-dependencies';
import { GetMediaReadUrl } from '@modules/media/application/queries/get-media-read-url';
import { ListMediaAssets } from '@modules/media/application/queries/list-media-assets';
import { PrismaMediaAssetRepository } from '@modules/media/infrastructure/prisma/prisma-media-asset.repository';
import { PrismaMediaUsageRepository } from '@modules/media/infrastructure/prisma/prisma-media-usage.repository';
import { createWebsiteDraft } from '@modules/website/domain/models/website';
import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import { PrismaWebsiteRepository } from '@modules/website/infrastructure/prisma/prisma-website.repository';

import { db, disconnectDb } from '@lib/db';
import { S3ObjectStore } from '@lib/storage/s3-object-store';

import { createTestRateLimiter } from '../../../support/rate-limiting';
import { RecordingMediaAuditLog, actorWithRole, accessFor } from '../support/fakes';

const env = process.env;
const enabled =
  env['BOOKING_TEST_DATABASE_URL'] !== undefined &&
  env['STORAGE_TEST_S3_ENDPOINT'] !== undefined &&
  env['STORAGE_TEST_PUBLIC_BASE_URL'] !== undefined;

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 1, 2, 3, 4,
]);
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>!!');

describe.skipIf(!enabled)(
  'upload flow: real use cases, real Postgres, real S3-compatible store',
  () => {
    const suffix = Math.random().toString(36).slice(2, 10);
    const websites = new PrismaWebsiteRepository();
    const slugs = [`e2e-a-${suffix}`, `e2e-b-${suffix}`];
    let deps: MediaDependencies;
    let adminDeps: MediaDependencies;
    let outsiderDeps: MediaDependencies;
    let tenant: ReturnType<typeof toTenantId>;
    let otherTenant: ReturnType<typeof toTenantId>;

    /** An option only when its variable is set: the store's options take absent, not `undefined`. */
    const optionFrom = (
      key: 'publicBucket' | 'privateBucket' | 'publicBaseUrl',
      variable: string,
    ) => {
      const value = env[variable];
      return value ? { [key]: value } : {};
    };

    const store = new S3ObjectStore({
      clock: { now: () => new Date() },
      region: env['STORAGE_TEST_S3_REGION'] ?? 'auto',
      endpoint: env['STORAGE_TEST_S3_ENDPOINT'] ?? '',
      accessKeyId: env['STORAGE_TEST_S3_ACCESS_KEY_ID'] ?? '',
      secretAccessKey: env['STORAGE_TEST_S3_SECRET_ACCESS_KEY'] ?? '',
      ...optionFrom('publicBucket', 'STORAGE_TEST_S3_PUBLIC_BUCKET'),
      ...optionFrom('privateBucket', 'STORAGE_TEST_S3_PRIVATE_BUCKET'),
      ...optionFrom('publicBaseUrl', 'STORAGE_TEST_PUBLIC_BASE_URL'),
    });

    const fresh = async (slug: string) => {
      const draft = createWebsiteDraft({
        name: slug,
        slug,
        description: null,
        templateKey: 'municipal',
      })._unsafeUnwrap();
      return toTenantId(
        (await websites.create({ draft, theme: DEFAULT_WEBSITE_THEME }))._unsafeUnwrap().id,
      );
    };
    /** The application's clock, which a test can move forward; the store keeps real time. */
    let skewMs = 0;
    const dependencies = (
      role: 'editor' | 'admin',
      tenantId: ReturnType<typeof toTenantId>,
    ): MediaDependencies => ({
      access: accessFor(actorWithRole(tenantId, role)),
      assets: new PrismaMediaAssetRepository(),
      usage: new PrismaMediaUsageRepository(),
      audit: new RecordingMediaAuditLog(),
      clock: { now: () => new Date(Date.now() + skewMs) },
      rateLimiter: createTestRateLimiter(),
      store,
    });

    beforeAll(async () => {
      tenant = await fresh(slugs[0] ?? '');
      otherTenant = await fresh(slugs[1] ?? '');
      deps = dependencies('editor', tenant);
      adminDeps = dependencies('admin', tenant);
      outsiderDeps = dependencies('admin', otherTenant);
    });

    afterAll(async () => {
      for (const slug of slugs) {
        await db.orm.public.Website.where({ slug }).deleteAndCount();
      }
      await disconnectDb();
    });

    /** What the browser does with the permission it was given. */
    const send = (requested: RequestedUpload, body: Uint8Array) =>
      fetch(requested.upload.url, {
        method: 'PUT',
        headers: { ...requested.upload.headers },
        body: body.slice(),
      });

    const announce = (visibility: 'public' | 'private', bytes = PNG) => ({
      websiteId: tenant as string,
      fileName: 'town-hall.png',
      contentType: 'image/png',
      byteSize: bytes.byteLength,
      visibility,
    });

    it('takes a public image from request to delivery to deletion', async () => {
      const requested = (
        await new RequestMediaUpload(deps).execute(announce('public'))
      )._unsafeUnwrap();
      expect((await send(requested, PNG)).ok).toBe(true);

      const done = (
        await new CompleteMediaUpload(deps).execute({ websiteId: tenant, id: requested.asset.id })
      )._unsafeUnwrap();
      expect(done.status).toBe('ready');

      // Anyone on the internet can now load it, as the stored type, cacheable for good.
      const served = await fetch(done.publicUrl ?? '');
      expect(served.status).toBe(200);
      expect(served.headers.get('content-type')).toBe('image/png');
      expect(served.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);

      const listed = (await new ListMediaAssets(deps).execute(tenant))._unsafeUnwrap();
      expect(listed.items.map((item) => item.id)).toContain(requested.asset.id);

      expect(
        (
          await new DeleteMediaAsset(adminDeps).execute({
            websiteId: tenant,
            id: requested.asset.id,
          })
        ).isOk(),
      ).toBe(true);
      expect((await fetch(done.publicUrl ?? '')).status).not.toBe(200);
      expect(
        (await new ListMediaAssets(deps).execute(tenant))
          ._unsafeUnwrap()
          .items.map((item) => item.id),
      ).not.toContain(requested.asset.id);
    });

    it('removes an HTML file that was uploaded under an image type, from the store and the database', async () => {
      // The store accepts it: type and size match what was signed. Only the content check can catch it.
      const requested = (
        await new RequestMediaUpload(deps).execute(announce('public', HTML))
      )._unsafeUnwrap();
      expect((await send(requested, HTML)).ok).toBe(true);
      const key = `sites/${tenant}/media/${requested.asset.id}`;
      expect((await store.head({ visibility: 'public', key }))._unsafeUnwrap()).not.toBeNull();

      const outcome = await new CompleteMediaUpload(deps).execute({
        websiteId: tenant,
        id: requested.asset.id,
      });
      expect(outcome._unsafeUnwrapErr().code).toBe('media.upload_rejected');

      expect((await store.head({ visibility: 'public', key }))._unsafeUnwrap()).toBeNull();
      expect(
        (
          await new PrismaMediaAssetRepository().findById(requested.asset.id as never, tenant)
        )._unsafeUnwrap(),
      ).toBeNull();
    });

    it('keeps a private image off the public origin and readable only through a short-lived link', async () => {
      const requested = (
        await new RequestMediaUpload(deps).execute(announce('private'))
      )._unsafeUnwrap();
      expect((await send(requested, PNG)).ok).toBe(true);
      await new CompleteMediaUpload(deps).execute({ websiteId: tenant, id: requested.asset.id });

      const key = `sites/${tenant}/media/${requested.asset.id}`;
      expect((await fetch(`${env['STORAGE_TEST_PUBLIC_BASE_URL'] ?? ''}/${key}`)).status).not.toBe(
        200,
      );

      const link = (
        await new GetMediaReadUrl(deps).execute({ websiteId: tenant, id: requested.asset.id })
      )._unsafeUnwrap();
      const read = await fetch(link.url);
      expect(read.status).toBe(200);
      expect(new Uint8Array(await read.arrayBuffer())).toEqual(PNG);
      expect(read.headers.get('cache-control')).toBe('private, no-store');
    });

    it("does not let another website touch this website's file", async () => {
      const requested = (
        await new RequestMediaUpload(deps).execute(announce('public'))
      )._unsafeUnwrap();
      await send(requested, PNG);
      await new CompleteMediaUpload(deps).execute({ websiteId: tenant, id: requested.asset.id });

      expect(
        (
          await new CompleteMediaUpload(outsiderDeps).execute({
            websiteId: otherTenant,
            id: requested.asset.id,
          })
        )._unsafeUnwrapErr().code,
      ).toBe('media.not_found');
      expect(
        (
          await new DeleteMediaAsset(outsiderDeps).execute({
            websiteId: otherTenant,
            id: requested.asset.id,
          })
        )._unsafeUnwrapErr().code,
      ).toBe('media.not_found');
      expect(
        (await new ListMediaAssets(outsiderDeps).execute(otherTenant))._unsafeUnwrap().items,
      ).toEqual([]);
      // Naming this website is refused outright: the outsider has no membership in it.
      expect(
        (
          await new DeleteMediaAsset(outsiderDeps).execute({
            websiteId: tenant,
            id: requested.asset.id,
          })
        )._unsafeUnwrapErr().code,
      ).toBe('auth.permission_denied');
      // Still there for its owner.
      expect(
        (
          await store.head({
            visibility: 'public',
            key: `sites/${tenant}/media/${requested.asset.id}`,
          })
        )._unsafeUnwrap(),
      ).not.toBeNull();
    });

    it('clears an upload nobody finished, object and row, on the next upload', async () => {
      const abandoned = (
        await new RequestMediaUpload(deps).execute(announce('public'))
      )._unsafeUnwrap();
      expect((await send(abandoned, PNG)).ok).toBe(true);
      const key = `sites/${tenant}/media/${abandoned.asset.id}`;
      expect((await store.head({ visibility: 'public', key }))._unsafeUnwrap()).not.toBeNull();

      skewMs = 16 * 60_000;
      try {
        (await new RequestMediaUpload(deps).execute(announce('public')))._unsafeUnwrap();
      } finally {
        skewMs = 0;
      }

      expect((await store.head({ visibility: 'public', key }))._unsafeUnwrap()).toBeNull();
      expect(
        (
          await new PrismaMediaAssetRepository().findById(abandoned.asset.id as never, tenant)
        )._unsafeUnwrap(),
      ).toBeNull();
    });

    it('refuses to delete a file a page or a release still uses, and deletes it once nothing does', async () => {
      const requested = (
        await new RequestMediaUpload(deps).execute(announce('public'))
      )._unsafeUnwrap();
      await send(requested, PNG);
      await new CompleteMediaUpload(deps).execute({ websiteId: tenant, id: requested.asset.id });

      const page = await db.orm.public.Page.create({
        tenantId: tenant,
        websiteId: tenant,
        path: `/e2e-${randomUUID().slice(0, 8)}`,
        title: 'E2E',
      });
      await db.orm.public.PageConfig.create({
        pageId: page.id,
        version: 1,
        content: JSON.parse(JSON.stringify({ children: [{ image: requested.asset.id }] })) as never,
      });

      expect(
        (
          await new DeleteMediaAsset(adminDeps).execute({
            websiteId: tenant,
            id: requested.asset.id,
          })
        )._unsafeUnwrapErr().code,
      ).toBe('media.in_use');
      expect(
        (
          await store.head({
            visibility: 'public',
            key: `sites/${tenant}/media/${requested.asset.id}`,
          })
        )._unsafeUnwrap(),
      ).not.toBeNull();

      // A newer version of the page no longer mentions it.
      await db.orm.public.PageConfig.create({
        pageId: page.id,
        version: 2,
        content: JSON.parse('{"children":[]}') as never,
      });
      expect(
        (
          await new DeleteMediaAsset(adminDeps).execute({
            websiteId: tenant,
            id: requested.asset.id,
          })
        ).isOk(),
      ).toBe(true);
    });
  },
);
