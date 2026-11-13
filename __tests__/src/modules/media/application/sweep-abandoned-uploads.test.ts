import { describe, expect, it } from 'vitest';

import { MEDIA_LIMITS } from '@modules/media/domain/models/media-asset';

import {
  OTHER_TENANT,
  TENANT,
  actorWithRole,
  mediaWorld,
  photo,
  uploadedAsset,
} from '../support/fakes';

import type { MediaWorld } from '../support/fakes';

const editor = actorWithRole(TENANT, 'editor');
const LIFETIME_MINUTES = MEDIA_LIMITS.pendingLifetimeSeconds / 60;

/** Starts an upload whose client sent the file but never confirmed, then lets its lifetime run out. */
async function abandon(world: MediaWorld, count = 1) {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    ids.push((await uploadedAsset(world)).asset.id);
  }
  world.clock.advanceMinutes(LIFETIME_MINUTES + 1);
  return ids;
}

const locationOf = (world: MediaWorld, id: string) =>
  ({ visibility: 'public', key: world.assets.rows.get(id)?.objectKey ?? '' }) as const;

describe('clearing abandoned uploads', () => {
  it('removes the object and the row of an upload nobody finished, on the next upload', async () => {
    const world = mediaWorld(editor);
    const [abandoned] = await abandon(world);
    const where = locationOf(world, abandoned ?? '');

    (await world.requestUpload.execute(photo()))._unsafeUnwrap();

    expect(world.assets.rows.has(abandoned ?? '')).toBe(false);
    expect(world.store.has(where)).toBe(false);
    expect(world.audit.types()).toContain('media.abandoned_removed');
  });

  it('lets a website that was full of stale uploads upload again', async () => {
    const world = mediaWorld(editor);
    await abandon(world, MEDIA_LIMITS.maxPendingPerTenant);

    expect((await world.requestUpload.execute(photo())).isOk()).toBe(true);
  });

  it('leaves uploads that are still within their lifetime, and every finished file, alone', async () => {
    const world = mediaWorld(editor);
    const { asset: finished } = await uploadedAsset(world);
    await world.completeUpload.execute({ websiteId: world.websiteId, id: finished.id });
    const { asset: fresh } = await uploadedAsset(world);
    world.clock.advanceMinutes(LIFETIME_MINUTES - 5);

    (await world.requestUpload.execute(photo()))._unsafeUnwrap();

    expect(world.assets.rows.get(finished.id)?.status).toBe('ready');
    expect(world.assets.rows.get(fresh.id)?.status).toBe('pending');
    expect(world.store.objectCount).toBe(2);
  });

  it("never touches another website's uploads", async () => {
    const owner = mediaWorld(editor);
    const [foreign] = await abandon(owner);
    const other = mediaWorld(actorWithRole(OTHER_TENANT, 'editor'), {
      assets: owner.assets,
      store: owner.store,
      clock: owner.clock,
    });

    (await other.requestUpload.execute(photo({ websiteId: other.websiteId })))._unsafeUnwrap();

    expect(owner.assets.rows.get(foreign ?? '')?.status).toBe('pending');
    expect(owner.store.has(locationOf(owner, foreign ?? ''))).toBe(true);
  });

  it('clears a few at a time, so one request never does unbounded work', async () => {
    const world = mediaWorld(editor);
    await abandon(world, MEDIA_LIMITS.sweepBatch + 5);

    (await world.requestUpload.execute(photo()))._unsafeUnwrap();
    expect(world.assets.rows.size).toBe(5 + 1);

    (await world.requestUpload.execute(photo()))._unsafeUnwrap();
    expect(world.assets.rows.size).toBe(2);
  });

  describe('when something fails', () => {
    it('does not fail the upload request, and records that the sweep could not run', async () => {
      const world = mediaWorld(editor);
      await abandon(world);
      world.assets.failNext('claimAbandoned');

      expect((await world.requestUpload.execute(photo())).isOk()).toBe(true);
      expect(world.audit.events.some((e) => e.type === 'media.cleanup_failed')).toBe(true);
    });

    it('keeps a file hidden, and findable, when its object cannot be removed, and finishes later', async () => {
      const world = mediaWorld(editor);
      const [stuck] = await abandon(world);
      world.store.failNext('delete');

      (await world.requestUpload.execute(photo()))._unsafeUnwrap();
      expect(world.assets.rows.get(stuck ?? '')?.status).toBe('deleting');
      expect(world.store.has(locationOf(world, stuck ?? ''))).toBe(true);
      expect(world.audit.types()).toContain('media.cleanup_failed');

      // A stalled deletion is picked up again once its lease has run out.
      world.clock.advanceMinutes(LIFETIME_MINUTES + 1);
      (await world.requestUpload.execute(photo()))._unsafeUnwrap();
      expect(world.assets.rows.has(stuck ?? '')).toBe(false);
      expect(world.store.has(locationOf(world, stuck ?? ''))).toBe(false);
    });

    it('does not clear a deletion that is only just under way', async () => {
      const world = mediaWorld(editor);
      const [stuck] = await abandon(world);
      world.store.failNext('delete');
      (await world.requestUpload.execute(photo()))._unsafeUnwrap();

      world.clock.advanceMinutes(1);
      (await world.requestUpload.execute(photo()))._unsafeUnwrap();
      expect(world.assets.rows.get(stuck ?? '')?.status).toBe('deleting');
    });

    it('keeps the row when the object went but the row could not be removed, and retries later', async () => {
      const world = mediaWorld(editor);
      const [stuck] = await abandon(world);
      world.assets.failNext('deleteById');

      (await world.requestUpload.execute(photo()))._unsafeUnwrap();
      expect(world.assets.rows.get(stuck ?? '')?.status).toBe('deleting');
      expect(world.store.has(locationOf(world, stuck ?? ''))).toBe(false);

      world.clock.advanceMinutes(LIFETIME_MINUTES + 1);
      (await world.requestUpload.execute(photo()))._unsafeUnwrap();
      expect(world.assets.rows.has(stuck ?? '')).toBe(false);
    });
  });
});
