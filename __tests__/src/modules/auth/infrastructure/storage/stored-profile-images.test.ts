import { afterEach, describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import { StoredProfileImages } from '@modules/auth/infrastructure/storage/stored-profile-images';

import type { UploadTarget } from '@lib/storage';

import { InMemoryObjectStore } from '../../../../lib/storage/support/in-memory-object-store';

const actorId = toActorId('account-1');
const imageId = '123e4567-e89b-12d3-a456-426614174000';
const location = { visibility: 'public', key: `profiles/${actorId}/${imageId}` } as const;
const image = {
  contentType: 'image/png',
  bytes: Uint8Array.from(Buffer.from('89504e470d0a1a0a', 'hex')),
};

function world() {
  const store = new InMemoryObjectStore({ clock: { now: () => new Date('2026-01-01') } });
  const targets = new Map<string, UploadTarget>();
  const createTarget = store.createUploadTarget.bind(store);
  store.createUploadTarget = (request) =>
    createTarget(request).map((target) => {
      targets.set(target.url, target);
      return target;
    });
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    const target = targets.get(url);
    if (!target || !(options.body instanceof Uint8Array)) {
      return new Response(null, { status: 400 });
    }
    store.simulateClientUpload(target, { body: options.body, headers: target.headers });
    return new Response(null, { status: 200 });
  });
  return {
    store,
    images: new StoredProfileImages({ getStore: () => store, newId: () => imageId }),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('StoredProfileImages', () => {
  it('stores exact validated bytes and deletes only the owner image', async () => {
    const { images, store } = world();
    const url = (await images.upload(actorId, image))._unsafeUnwrap();
    expect((await store.readStart(location, image.bytes.length))._unsafeUnwrap()).toEqual(
      image.bytes,
    );
    expect(url).toBe(store.publicUrl(location.key));
    expect((await images.remove(actorId, url)).isOk()).toBe(true);
    expect((await store.head(location))._unsafeUnwrap()).toBeNull();
  });

  it('refuses foreign-owner, external and traversal addresses without deleting stored images', async () => {
    const { images, store } = world();
    const url = (await images.upload(actorId, image))._unsafeUnwrap();
    await images.remove(toActorId('account-2'), url);
    await images.remove(actorId, `https://external.example/profiles/${actorId}/${imageId}`);
    await images.remove(actorId, `${url}/../other`);
    expect((await store.head(location))._unsafeUnwrap()).not.toBeNull();
  });

  it('returns a stable failure when transport rejects or is unavailable', async () => {
    const { images } = world();
    vi.stubGlobal('fetch', async () => new Response(null, { status: 503 }));
    expect((await images.upload(actorId, image))._unsafeUnwrapErr().code).toBe(
      'auth.provider_failed',
    );
    vi.stubGlobal('fetch', () => Promise.reject(new Error('private service details')));
    expect((await images.upload(actorId, image))._unsafeUnwrapErr().message).not.toContain(
      'private',
    );
  });
});
