import { describe, expect, it } from 'vitest';

import { MEDIA_LIMITS } from '@modules/media/domain/models/media-asset';

import type { Result } from '@lib/result';

import { InMemoryObjectStore } from '../../../lib/storage/support/in-memory-object-store';
import {
  HTML,
  JPEG,
  OTHER_TENANT,
  PNG,
  TENANT,
  actorWithRole,
  mediaWorld,
  photo,
  uploadedAsset,
} from '../support/fakes';

const editor = actorWithRole(TENANT, 'editor');
const asEditor = () => mediaWorld(editor);

const codeOf = async <T, E extends { code: string }>(result: PromiseLike<Result<T, E>>) =>
  (await result)._unsafeUnwrapErr().code;

describe('RequestMediaUpload', () => {
  it('reserves a row first and then signs exactly that file', async () => {
    const world = asEditor();
    const { asset, upload } = (await world.requestUpload.execute(photo()))._unsafeUnwrap();

    const row = world.assets.rows.get(asset.id);
    expect(row).toMatchObject({ status: 'pending', tenantId: TENANT, createdBy: editor.id });
    expect(row?.objectKey).toBe(`sites/${TENANT}/media/${asset.id}`);
    expect(upload.method).toBe('PUT');
    expect(upload.headers['content-type']).toBe('image/png');
    expect(upload.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(world.audit.types()).toEqual(['media.upload_authorised']);
  });

  it('never lets a client file name, or anything else the client wrote, into the key', async () => {
    const world = asEditor();
    const { asset } = (
      await world.requestUpload.execute(photo({ fileName: '../../other/evil.png' }))
    )._unsafeUnwrap();
    const key = world.assets.rows.get(asset.id)?.objectKey ?? '';

    expect(key).not.toMatch(/evil|\.\.|other/);
    expect(asset.originalFilename).toBe('evil.png');
  });

  it('keeps the signed upload out of the audit trail', async () => {
    const world = asEditor();
    const { upload } = (await world.requestUpload.execute(photo()))._unsafeUnwrap();
    expect(JSON.stringify(world.audit.events)).not.toContain(upload.url);
  });

  it('signs private files with a no-store cache policy', async () => {
    const { upload } = (
      await asEditor().requestUpload.execute(photo({ visibility: 'private' }))
    )._unsafeUnwrap();
    expect(upload.headers['cache-control']).toBe('private, no-store');
  });

  it.each(['viewer', 'contributor'] as const)('is forbidden to a %s', async (role) => {
    const world = mediaWorld(actorWithRole(TENANT, role));
    expect(await codeOf(world.requestUpload.execute(photo()))).toBe('auth.permission_denied');
    expect(world.assets.rows.size).toBe(0);
  });

  it('is forbidden to someone who is not signed in, before anything is checked', async () => {
    const world = mediaWorld(null);
    expect(await codeOf(world.requestUpload.execute(photo({ contentType: 'text/html' })))).toBe(
      'auth.permission_denied',
    );
  });

  it('refuses a file that is not an accepted image, and writes nothing', async () => {
    const world = asEditor();
    expect(await codeOf(world.requestUpload.execute(photo({ contentType: 'image/svg+xml' })))).toBe(
      'media.validation_failed',
    );
    expect(world.assets.rows.size).toBe(0);
    expect(world.store.objectCount).toBe(0);
  });

  it('refuses a visibility the store has no bucket for', async () => {
    const base = mediaWorld(editor);
    const publicOnly = mediaWorld(editor, {
      store: new InMemoryObjectStore({ clock: base.clock, visibilities: ['public'] }),
    });

    expect(await codeOf(publicOnly.requestUpload.execute(photo({ visibility: 'private' })))).toBe(
      'media.storage_disabled',
    );
    expect((await publicOnly.requestUpload.execute(photo())).isOk()).toBe(true);
  });

  it('bounds how many uploads one website can leave unfinished, and lets expired ones go', async () => {
    const world = asEditor();
    for (let i = 0; i < MEDIA_LIMITS.maxPendingPerTenant; i += 1) {
      (await world.requestUpload.execute(photo()))._unsafeUnwrap();
    }
    expect(await codeOf(world.requestUpload.execute(photo()))).toBe('media.too_many_pending');

    world.clock.advanceMinutes(MEDIA_LIMITS.pendingLifetimeSeconds / 60 + 1);
    expect((await world.requestUpload.execute(photo())).isOk()).toBe(true);
  });

  it('counts only its own website against the limit', async () => {
    const world = asEditor();
    for (let i = 0; i < MEDIA_LIMITS.maxPendingPerTenant; i += 1) {
      (await world.requestUpload.execute(photo()))._unsafeUnwrap();
    }
    const other = mediaWorld(actorWithRole(OTHER_TENANT, 'editor'), {
      assets: world.assets,
      store: world.store,
      clock: world.clock,
    });
    expect((await other.requestUpload.execute(photo({ websiteId: other.websiteId }))).isOk()).toBe(
      true,
    );
  });

  describe('when something fails half way', () => {
    it('issues no permission when the row cannot be saved', async () => {
      const world = asEditor();
      world.assets.failNext('createPending');
      expect(await codeOf(world.requestUpload.execute(photo()))).toBe('media.persistence_failed');
      expect(world.audit.events).toEqual([]);
    });

    it('withdraws the row when the permission cannot be signed', async () => {
      const world = asEditor();
      world.store.failNext('createUploadTarget');
      expect(await codeOf(world.requestUpload.execute(photo()))).toBe('media.storage_failed');
      expect(world.assets.rows.size).toBe(0);
    });

    it('leaves a findable, expiring row when even the withdrawal fails, and says so', async () => {
      const world = asEditor();
      world.store.failNext('createUploadTarget');
      world.assets.failNext('deleteById');

      expect(await codeOf(world.requestUpload.execute(photo()))).toBe('media.storage_failed');
      expect([...world.assets.rows.values()].map((row) => row.status)).toEqual(['pending']);
      expect(world.audit.types()).toEqual(['media.cleanup_failed']);
    });
  });
});

describe('CompleteMediaUpload', () => {
  it('makes a verified upload ready and gives a public file its public address', async () => {
    const world = asEditor();
    const { asset } = await uploadedAsset(world);

    const done = (
      await world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })
    )._unsafeUnwrap();
    expect(done).toMatchObject({ status: 'ready', visibility: 'public' });
    expect(done.publicUrl).toBe(`https://media.example.test/sites/${TENANT}/media/${asset.id}`);
    expect(world.audit.types()).toEqual(['media.upload_authorised', 'media.upload_completed']);
  });

  it('gives a private file no public address at all', async () => {
    const world = asEditor();
    const { asset } = await uploadedAsset(world, { visibility: 'private' });
    expect(
      (
        await world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })
      )._unsafeUnwrap().publicUrl,
    ).toBeNull();
  });

  it('is safe to call twice: the second call just sees the finished asset', async () => {
    const world = asEditor();
    const { asset } = await uploadedAsset(world);
    await world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id });

    expect(
      (
        await world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })
      )._unsafeUnwrap().status,
    ).toBe('ready');
    expect(world.audit.types().filter((type) => type === 'media.upload_completed')).toHaveLength(1);
  });

  it('lets two simultaneous finalisations both succeed, with only one winning the write', async () => {
    const world = asEditor();
    const { asset } = await uploadedAsset(world);

    const [a, b] = await Promise.all([
      world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id }),
      world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id }),
    ]);
    expect(a.isOk() && b.isOk()).toBe(true);
    expect(world.assets.rows.get(asset.id)?.status).toBe('ready');
  });

  it('does not take the client at its word when nothing was uploaded', async () => {
    const world = asEditor();
    const { asset } = (await world.requestUpload.execute(photo()))._unsafeUnwrap();

    expect(
      await codeOf(world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })),
    ).toBe('media.upload_missing');
    expect(world.assets.rows.get(asset.id)?.status).toBe('pending');
  });

  it('can be retried after the missing upload arrives', async () => {
    const world = asEditor();
    const requested = (await world.requestUpload.execute(photo()))._unsafeUnwrap();
    await world.completeUpload.execute({ websiteId: world.websiteId, id: requested.asset.id });

    world.store.simulateClientUpload({ kind: 'http-put', ...requested.upload }, { body: PNG });
    expect(
      (
        await world.completeUpload.execute({ websiteId: world.websiteId, id: requested.asset.id })
      )._unsafeUnwrap().status,
    ).toBe('ready');
  });

  describe('verifying what was really stored', () => {
    const rejected = async (stored: { bytes: Uint8Array; contentType: string }) => {
      const world = asEditor();
      const { asset } = (
        await world.requestUpload.execute(photo({ byteSize: stored.bytes.byteLength }))
      ).unwrapOr(null as never);
      const location = {
        visibility: 'public',
        key: world.assets.rows.get(asset.id)?.objectKey ?? '',
      } as const;
      world.store.seed(location, stored.bytes, stored.contentType);

      const code = await codeOf(
        world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id }),
      );
      return { world, asset, location, code };
    };

    it('removes a file whose content is not the announced image (HTML under an image type)', async () => {
      const { world, asset, location, code } = await rejected({
        bytes: HTML,
        contentType: 'image/png',
      });
      expect(code).toBe('media.upload_rejected');
      expect(world.store.has(location)).toBe(false);
      expect(world.assets.rows.has(asset.id)).toBe(false);
      expect(
        world.audit.events.some(
          (e) => e.type === 'media.upload_rejected' && e.reason === 'signature',
        ),
      ).toBe(true);
    });

    it('removes a file that is another image format than announced', async () => {
      const { code } = await rejected({ bytes: JPEG, contentType: 'image/png' });
      expect(code).toBe('media.upload_rejected');
    });

    it('removes a file stored under a different content type', async () => {
      const { world, location, code } = await rejected({ bytes: PNG, contentType: 'text/html' });
      expect(code).toBe('media.upload_rejected');
      expect(world.store.has(location)).toBe(false);
    });

    it('removes a file of a different size than announced', async () => {
      const world = asEditor();
      const { asset } = (
        await world.requestUpload.execute(photo({ byteSize: 999 }))
      )._unsafeUnwrap();
      const location = {
        visibility: 'public',
        key: world.assets.rows.get(asset.id)?.objectKey ?? '',
      } as const;
      world.store.seed(location, PNG, 'image/png');

      expect(
        await codeOf(world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })),
      ).toBe('media.upload_rejected');
      expect(world.store.has(location)).toBe(false);
      expect(
        world.audit.events.some((e) => e.type === 'media.upload_rejected' && e.reason === 'size'),
      ).toBe(true);
    });

    it('still reports the rejection, and records the leftover, when cleanup fails', async () => {
      const world = asEditor();
      const { asset } = (
        await world.requestUpload.execute(photo({ byteSize: HTML.byteLength }))
      )._unsafeUnwrap();
      const location = {
        visibility: 'public',
        key: world.assets.rows.get(asset.id)?.objectKey ?? '',
      } as const;
      world.store.seed(location, HTML, 'image/png');
      world.store.failNext('delete');

      expect(
        await codeOf(world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })),
      ).toBe('media.upload_rejected');
      // The row stays PENDING and expires, so the object is still findable.
      expect(world.assets.rows.get(asset.id)?.status).toBe('pending');
      expect(world.audit.types()).toContain('media.cleanup_failed');
    });
  });

  describe('when the infrastructure fails', () => {
    it('keeps the asset pending and retryable when the store is down', async () => {
      const world = asEditor();
      const { asset } = await uploadedAsset(world);
      world.store.failNext('head');

      expect(
        await codeOf(world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })),
      ).toBe('media.storage_failed');
      expect(world.assets.rows.get(asset.id)?.status).toBe('pending');
      expect(
        (
          await world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })
        )._unsafeUnwrap().status,
      ).toBe('ready');
    });

    it('loses nothing when the database fails after the file was verified', async () => {
      const world = asEditor();
      const { asset } = await uploadedAsset(world);
      world.assets.failNext('markReady');

      expect(
        await codeOf(world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })),
      ).toBe('media.persistence_failed');
      expect(world.store.objectCount).toBe(1);
      expect(
        (
          await world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })
        )._unsafeUnwrap().status,
      ).toBe('ready');
    });
  });

  describe('tenant isolation', () => {
    it("answers another website's asset exactly like one that does not exist", async () => {
      const owner = asEditor();
      const { asset } = await uploadedAsset(owner);
      const intruder = mediaWorld(actorWithRole(OTHER_TENANT, 'editor'), {
        assets: owner.assets,
        store: owner.store,
        clock: owner.clock,
      });

      const foreign = await intruder.completeUpload.execute({
        websiteId: intruder.websiteId,
        id: asset.id,
      });
      const missing = await intruder.completeUpload.execute({
        websiteId: intruder.websiteId,
        id: '9b0d6b5e-6a0f-4f6e-8e6c-1d2c3b4a5f60',
      });

      expect(foreign._unsafeUnwrapErr()).toEqual(missing._unsafeUnwrapErr());
      expect(owner.assets.rows.get(asset.id)?.status).toBe('pending');
    });

    it('refuses an id that is not a UUID before it can reach a key', async () => {
      expect(
        await codeOf(
          asEditor().completeUpload.execute({ websiteId: TENANT, id: '../../other/asset' }),
        ),
      ).toBe('media.validation_failed');
    });

    it('is forbidden to a viewer, who learns nothing about which ids exist', async () => {
      const owner = asEditor();
      const { asset } = await uploadedAsset(owner);
      const viewer = mediaWorld(actorWithRole(TENANT, 'viewer'), {
        assets: owner.assets,
        store: owner.store,
        clock: owner.clock,
      });
      expect(
        await codeOf(viewer.completeUpload.execute({ websiteId: viewer.websiteId, id: asset.id })),
      ).toBe('auth.permission_denied');
    });

    it('treats an asset on its way out as gone', async () => {
      const world = asEditor();
      const { asset } = await uploadedAsset(world);
      await world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id });

      // Editors may not delete; an admin of the same website starts a delete that stalls.
      const admin = mediaWorld(actorWithRole(TENANT, 'admin'), {
        assets: world.assets,
        store: world.store,
        clock: world.clock,
      });
      world.store.failNext('delete');
      await admin.deleteAsset.execute({ websiteId: admin.websiteId, id: asset.id });
      expect(world.assets.rows.get(asset.id)?.status).toBe('deleting');

      expect(
        await codeOf(world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id })),
      ).toBe('media.not_found');
    });
  });
});
