import { describe, expect, it } from 'vitest';

import type { Clock } from '@lib/clock';
import { storageUnavailable } from '@lib/storage';
import type { ObjectLocation, UploadRequest } from '@lib/storage';

import { InMemoryObjectStore, UploadRefused } from './support/in-memory-object-store';
import { describeObjectStoreContract } from './support/object-store-contract';

class ManualClock implements Clock {
  constructor(private current = new Date('2026-10-18T10:00:00.000Z')) {}
  now(): Date {
    return this.current;
  }
  advanceSeconds(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}

describeObjectStoreContract('InMemoryObjectStore', () => {
  const store = new InMemoryObjectStore({ clock: new ManualClock() });
  let run = 0;
  return {
    store,
    upload: (target, body) => {
      store.simulateClientUpload(target, { body });
      return Promise.resolve();
    },
    uniquePrefix: () => `contract/${(run += 1)}`,
  };
});

const PNG = new Uint8Array([1, 2, 3, 4]);
const PUBLIC: ObjectLocation = { visibility: 'public', key: 'sites/s1/media/a1' };
const request: UploadRequest = {
  location: PUBLIC,
  contentType: 'image/png',
  byteSize: PNG.byteLength,
  cacheControl: 'public, max-age=60',
  expiresInSeconds: 60,
};

describe('InMemoryObjectStore: the signed terms of an upload', () => {
  async function target(store: InMemoryObjectStore) {
    return (await store.createUploadTarget(request))._unsafeUnwrap();
  }

  it('refuses a different content type, size, or another target', async () => {
    const store = new InMemoryObjectStore({ clock: new ManualClock() });
    const signed = await target(store);

    expect(() => {
      store.simulateClientUpload(signed, {
        body: PNG,
        headers: { ...signed.headers, 'content-type': 'text/html' },
      });
    }).toThrow(UploadRefused);
    expect(() => {
      store.simulateClientUpload(signed, { body: new Uint8Array(9) });
    }).toThrow(UploadRefused);
    expect(() => {
      store.simulateClientUpload(
        { ...signed, url: 'https://elsewhere.test/upload/grant-999' },
        { body: PNG },
      );
    }).toThrow(UploadRefused);
    expect(store.objectCount).toBe(0);
  });

  it('refuses an upload after the target has expired', async () => {
    const clock = new ManualClock();
    const store = new InMemoryObjectStore({ clock });
    const signed = await target(store);

    clock.advanceSeconds(61);
    expect(() => {
      store.simulateClientUpload(signed, { body: PNG });
    }).toThrow(UploadRefused);
  });

  it('does not make a target single-use, as no real store does', async () => {
    const store = new InMemoryObjectStore({ clock: new ManualClock() });
    const signed = await target(store);
    store.simulateClientUpload(signed, { body: PNG });
    store.simulateClientUpload(signed, { body: new Uint8Array([9, 9, 9, 9]) });
    expect(Array.from((await store.readStart(PUBLIC, 4))._unsafeUnwrap())).toEqual([9, 9, 9, 9]);
  });
});

describe('InMemoryObjectStore: visibilities and failures', () => {
  it('refuses a visibility it was not configured for', async () => {
    const publicOnly = new InMemoryObjectStore({
      clock: new ManualClock(),
      visibilities: ['public'],
    });
    const privateKey: ObjectLocation = { visibility: 'private', key: 'docs/one' };

    expect(publicOnly.supports('private')).toBe(false);
    expect((await publicOnly.head(privateKey))._unsafeUnwrapErr().code).toBe(
      'storage.visibility_unavailable',
    );
    expect(
      (await publicOnly.createReadUrl({ key: 'docs/one', expiresInSeconds: 60 }))._unsafeUnwrapErr()
        .code,
    ).toBe('storage.visibility_unavailable');
  });

  it('offers no public URL when nothing public is configured', () => {
    const privateOnly = new InMemoryObjectStore({
      clock: new ManualClock(),
      visibilities: ['private'],
    });
    expect(privateOnly.publicUrl('sites/s1/media/a1')).toBeNull();
  });

  it('fails one call on demand, once, like a provider outage', async () => {
    const store = new InMemoryObjectStore({ clock: new ManualClock() });
    store.failNext('head', storageUnavailable(new Error('boom')));

    expect((await store.head(PUBLIC))._unsafeUnwrapErr().code).toBe('storage.unavailable');
    expect((await store.head(PUBLIC)).isOk()).toBe(true);
  });
});
