import { describe, expect, it } from 'vitest';

import { actorHasPermission } from '@modules/auth';
import { MEDIA_PAGE_LIMITS } from '@modules/media/application/media-limits';

import type { Result } from '@lib/result';

import { OTHER_TENANT, TENANT, actorWithRole, mediaWorld, uploadedAsset } from '../support/fakes';

import type { MediaWorld } from '../support/fakes';

const codeOf = async <T, E extends { code: string }>(result: PromiseLike<Result<T, E>>) =>
  (await result)._unsafeUnwrapErr().code;

/** Several people of one website share one world: the same rows, the same store. */
function team(base: MediaWorld) {
  const shared = {
    assets: base.assets,
    store: base.store,
    usage: base.usage,
    audit: base.audit,
    clock: base.clock,
  };
  return {
    admin: mediaWorld(actorWithRole(TENANT, 'admin'), shared),
    editor: mediaWorld(actorWithRole(TENANT, 'editor'), shared),
    contributor: mediaWorld(actorWithRole(TENANT, 'contributor'), shared),
    viewer: mediaWorld(actorWithRole(TENANT, 'viewer'), shared),
    outsider: mediaWorld(actorWithRole(OTHER_TENANT, 'admin'), shared),
  };
}

async function readyAsset(world: MediaWorld, overrides: Parameters<typeof uploadedAsset>[1] = {}) {
  const { asset } = await uploadedAsset(world, overrides);
  await world.completeUpload.execute({ websiteId: world.websiteId, id: asset.id });
  return asset;
}

describe('who may do what with media', () => {
  const can = (
    role: 'admin' | 'editor' | 'contributor' | 'viewer',
    permission: 'media.read' | 'media.upload' | 'media.delete',
  ) => actorHasPermission(actorWithRole(TENANT, role), permission);

  it('lets admins do everything, editors read and upload, and nobody else anything', () => {
    expect(
      ['media.read', 'media.upload', 'media.delete'].map((p) => can('admin', p as 'media.read')),
    ).toEqual([true, true, true]);
    expect(
      ['media.read', 'media.upload', 'media.delete'].map((p) => can('editor', p as 'media.read')),
    ).toEqual([true, true, false]);
    for (const role of ['contributor', 'viewer'] as const) {
      expect(
        ['media.read', 'media.upload', 'media.delete'].some((p) => can(role, p as 'media.read')),
      ).toBe(false);
    }
  });
});

describe('DeleteMediaAsset', () => {
  it('removes the bytes, then the row, and says so', async () => {
    const { admin, editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const asset = await readyAsset(editor);
    const key = {
      visibility: 'public',
      key: editor.assets.rows.get(asset.id)?.objectKey ?? '',
    } as const;

    expect(
      (await admin.deleteAsset.execute({ websiteId: admin.websiteId, id: asset.id })).isOk(),
    ).toBe(true);
    expect(editor.assets.rows.has(asset.id)).toBe(false);
    expect(editor.store.has(key)).toBe(false);
    expect(admin.audit.types().at(-1)).toBe('media.deleted');
  });

  it('is forbidden to an editor, and changes nothing', async () => {
    const { editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const asset = await readyAsset(editor);

    expect(
      await codeOf(editor.deleteAsset.execute({ websiteId: editor.websiteId, id: asset.id })),
    ).toBe('auth.permission_denied');
    expect(editor.assets.rows.get(asset.id)?.status).toBe('ready');
  });

  it("cannot delete another website's file, and cannot tell it exists", async () => {
    const { editor, outsider } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const asset = await readyAsset(editor);

    expect(
      await codeOf(outsider.deleteAsset.execute({ websiteId: outsider.websiteId, id: asset.id })),
    ).toBe('media.not_found');
    expect(editor.assets.rows.get(asset.id)?.status).toBe('ready');
    expect(editor.store.objectCount).toBe(1);
  });

  it('refuses while the website still uses the file, and changes nothing', async () => {
    const { admin, editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const asset = await readyAsset(editor);
    admin.usage.referenced.add(asset.id);

    expect(
      await codeOf(admin.deleteAsset.execute({ websiteId: admin.websiteId, id: asset.id })),
    ).toBe('media.in_use');
    expect(admin.assets.rows.get(asset.id)?.status).toBe('ready');
    expect(admin.store.objectCount).toBe(1);
  });

  it('does not delete when it cannot find out whether the file is in use', async () => {
    const { admin, editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const asset = await readyAsset(editor);
    admin.usage.fail = true;

    expect(
      await codeOf(admin.deleteAsset.execute({ websiteId: admin.websiteId, id: asset.id })),
    ).toBe('media.persistence_failed');
    expect(admin.assets.rows.get(asset.id)?.status).toBe('ready');
    expect(admin.store.objectCount).toBe(1);
  });

  describe('when it fails half way', () => {
    it('hides the file, keeps the row, and finishes on the next attempt', async () => {
      const { admin, editor, viewer } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
      const asset = await readyAsset(editor);
      admin.store.failNext('delete');

      expect(
        await codeOf(admin.deleteAsset.execute({ websiteId: admin.websiteId, id: asset.id })),
      ).toBe('media.storage_failed');
      // Hidden everywhere, never a visible broken image, yet the object still has its row.
      expect(admin.assets.rows.get(asset.id)?.status).toBe('deleting');
      expect(admin.store.objectCount).toBe(1);
      expect((await editor.listAssets.execute(editor.websiteId))._unsafeUnwrap().items).toEqual([]);
      expect(viewer.audit.types()).toContain('media.cleanup_failed');

      expect(
        (await admin.deleteAsset.execute({ websiteId: admin.websiteId, id: asset.id })).isOk(),
      ).toBe(true);
      expect(admin.assets.rows.has(asset.id)).toBe(false);
      expect(admin.store.objectCount).toBe(0);
    });

    it('never leaves an object without a row: the row outlives a failed object delete', async () => {
      const { admin, editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
      const asset = await readyAsset(editor);
      admin.store.failNext('delete');
      await admin.deleteAsset.execute({ websiteId: admin.websiteId, id: asset.id });

      expect(admin.store.objectCount).toBe(1);
      expect(admin.assets.rows.size).toBe(1);
    });

    it('can be repeated when the row delete fails after the object is gone', async () => {
      const { admin, editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
      const asset = await readyAsset(editor);
      admin.assets.failNext('deleteById');

      expect(
        await codeOf(admin.deleteAsset.execute({ websiteId: admin.websiteId, id: asset.id })),
      ).toBe('media.persistence_failed');
      expect(admin.store.objectCount).toBe(0);
      expect(
        (await admin.deleteAsset.execute({ websiteId: admin.websiteId, id: asset.id })).isOk(),
      ).toBe(true);
      expect(admin.assets.rows.size).toBe(0);
    });

    it('lets an unfinished upload be cancelled', async () => {
      const { admin, editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
      const { asset } = (
        await editor.requestUpload.execute({
          websiteId: editor.websiteId,
          fileName: 'a.png',
          contentType: 'image/png',
          byteSize: 16,
          visibility: 'public',
        })
      )._unsafeUnwrap();

      expect(
        (await admin.deleteAsset.execute({ websiteId: admin.websiteId, id: asset.id })).isOk(),
      ).toBe(true);
      expect(admin.assets.rows.size).toBe(0);
    });
  });
});

describe('ListMediaAssets', () => {
  it("lists only this website's finished files, newest first", async () => {
    const { editor, outsider } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const first = await readyAsset(editor);
    editor.clock.advanceMinutes(1);
    const second = await readyAsset(editor);
    await editor.requestUpload.execute({
      websiteId: editor.websiteId,
      fileName: 'u.png',
      contentType: 'image/png',
      byteSize: 16,
      visibility: 'public',
    });
    await readyAsset(outsider);

    const listed = (await editor.listAssets.execute(editor.websiteId))._unsafeUnwrap();
    expect(listed.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([first.id, second.id]),
    );
    expect(listed.total).toBe(2);
    expect(listed.items.every((item) => item.status === 'ready')).toBe(true);
  });

  it('gives public files an address and private ones none', async () => {
    const { editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    await readyAsset(editor, { visibility: 'private' });
    await readyAsset(editor, { visibility: 'public' });

    const items = (await editor.listAssets.execute(editor.websiteId))._unsafeUnwrap().items;
    expect(items.filter((item) => item.publicUrl !== null)).toHaveLength(1);
    expect(items.find((item) => item.visibility === 'private')?.publicUrl).toBeNull();
  });

  it('pages, and never returns more than the bound however much is asked for', async () => {
    const { editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    for (let i = 0; i < 3; i += 1) {
      await readyAsset(editor);
    }

    const firstPage = (
      await editor.listAssets.execute(editor.websiteId, { page: 1, pageSize: 2 })
    )._unsafeUnwrap();
    expect([firstPage.items.length, firstPage.total, firstPage.pageCount]).toEqual([2, 3, 2]);
    const huge = (
      await editor.listAssets.execute(editor.websiteId, { pageSize: 100_000 })
    )._unsafeUnwrap();
    expect(huge.pageSize).toBe(MEDIA_PAGE_LIMITS.maxPageSize);
    const junk = (
      await editor.listAssets.execute(editor.websiteId, { page: 'abc', pageSize: -5 })
    )._unsafeUnwrap();
    expect(junk.page).toBe(1);
  });

  it('finds files by a part of their name and orders them by name when asked', async () => {
    const { editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    for (const fileName of ['townsquare.png', 'park.png', 'Town-hall.png']) {
      await readyAsset(editor, { fileName });
    }

    const found = (
      await editor.listAssets.execute(editor.websiteId, {
        search: 'TOWN',
        sort: { field: 'name', direction: 'asc' },
      })
    )._unsafeUnwrap();
    expect(found.items.map((item) => item.originalFilename)).toEqual([
      'Town-hall.png',
      'townsquare.png',
    ]);
    expect(found.total).toBe(2);
  });

  it('is forbidden to those who may not read media', async () => {
    const { contributor, viewer } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    expect(await codeOf(contributor.listAssets.execute(contributor.websiteId))).toBe(
      'auth.permission_denied',
    );
    expect(await codeOf(viewer.listAssets.execute(viewer.websiteId))).toBe(
      'auth.permission_denied',
    );
  });
});

describe('GetMediaReadUrl', () => {
  it('gives a short-lived link to a private file, and nothing is logged about it', async () => {
    const { editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const asset = await readyAsset(editor, { visibility: 'private' });

    const link = (
      await editor.getReadUrl.execute({ websiteId: editor.websiteId, id: asset.id })
    )._unsafeUnwrap();
    expect(link.url).toContain(`sites/${TENANT}/media/${asset.id}`);
    expect(link.expiresAt.getTime() - editor.clock.now().getTime()).toBe(300_000);
    expect(JSON.stringify(editor.audit.events)).not.toContain(link.url);
  });

  it('has no link for a public file, which is delivered from its public address', async () => {
    const { editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const asset = await readyAsset(editor);
    expect(
      await codeOf(editor.getReadUrl.execute({ websiteId: editor.websiteId, id: asset.id })),
    ).toBe('media.not_private');
  });

  it('has no link for a file that is not verified yet', async () => {
    const { editor } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const { asset } = (
      await editor.requestUpload.execute({
        websiteId: editor.websiteId,
        fileName: 'p.png',
        contentType: 'image/png',
        byteSize: 16,
        visibility: 'private',
      })
    )._unsafeUnwrap();
    expect(
      await codeOf(editor.getReadUrl.execute({ websiteId: editor.websiteId, id: asset.id })),
    ).toBe('media.not_ready');
  });

  it('is not available across websites, and does not reveal that the file exists', async () => {
    const { editor, outsider } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const asset = await readyAsset(editor, { visibility: 'private' });
    expect(
      await codeOf(outsider.getReadUrl.execute({ websiteId: outsider.websiteId, id: asset.id })),
    ).toBe('media.not_found');
  });

  it('is forbidden to those who may not read media', async () => {
    const { editor, viewer } = team(mediaWorld(actorWithRole(TENANT, 'editor')));
    const asset = await readyAsset(editor, { visibility: 'private' });
    expect(
      await codeOf(viewer.getReadUrl.execute({ websiteId: viewer.websiteId, id: asset.id })),
    ).toBe('auth.permission_denied');
  });
});
