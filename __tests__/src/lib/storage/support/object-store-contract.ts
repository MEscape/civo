import { describe, expect, it } from 'vitest';

import type { AppResultAsync } from '@lib/result';
import type { ObjectLocation, ObjectStore, StorageError, UploadTarget } from '@lib/storage';
import { MAX_SIGNED_URL_TTL_SECONDS, MAX_UPLOAD_BYTES } from '@lib/storage/storage-limits';

/**
 * What a test run needs from one implementation. The in-memory fake satisfies it today; the S3
 * adapter does against a real endpoint, so both are held to the same behaviour.
 */
export interface ContractSubject {
  readonly store: ObjectStore;
  /** The client's side of an upload, over whatever transport this implementation uses. */
  upload(target: UploadTarget, body: Uint8Array): Promise<void>;
  /** A key prefix no other run uses: real buckets are shared between runs. */
  uniquePrefix(): string;
}

async function settle<T>(
  result: AppResultAsync<T, StorageError>,
): Promise<{ ok: true; value: T } | { ok: false; error: StorageError }> {
  const settled = await result;
  return settled.isOk() ? { ok: true, value: settled.value } : { ok: false, error: settled.error };
}

async function expectOk<T>(result: AppResultAsync<T, StorageError>): Promise<T> {
  const settled = await settle(result);
  if (!settled.ok) {
    throw new Error(`Expected success, got ${settled.error.code}`);
  }
  return settled.value;
}

async function expectCode(result: AppResultAsync<unknown, StorageError>, code: string) {
  const settled = await settle(result);
  expect(settled.ok ? 'ok' : settled.error.code).toBe(code);
}

const BAD_KEYS = [
  '',
  '/leading',
  'trailing/',
  'a//b',
  '../escape',
  'a/../b',
  'a/./b',
  '..',
  'with space',
  'back\\slash',
  'a/%2e%2e/b',
  'ümlaut',
  'new\nline',
  'k'.repeat(1025),
];

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

export function describeObjectStoreContract(name: string, setup: () => ContractSubject): void {
  describe(`${name} fulfils the ObjectStore contract`, () => {
    const location = (
      subject: ContractSubject,
      visibility: 'public' | 'private',
    ): ObjectLocation => ({
      visibility,
      key: `${subject.uniquePrefix()}/asset`,
    });
    const upload = (target: ObjectLocation, body = PNG) => ({
      location: target,
      contentType: 'image/png',
      byteSize: body.byteLength,
      cacheControl: 'public, max-age=60',
      expiresInSeconds: 300,
    });

    it('serves public objects from a deterministic URL without I/O', () => {
      const { store } = setup();
      const url = store.publicUrl('sites/one/media/asset');
      expect(url).toMatch(/^https?:\/\/.+\/sites\/one\/media\/asset$/);
      expect(store.publicUrl('sites/one/media/asset')).toBe(url);
    });

    it.each(BAD_KEYS)('refuses the key %j everywhere', async (key) => {
      const { store } = setup();
      const bad: ObjectLocation = { visibility: 'public', key };
      expect(store.publicUrl(key)).toBeNull();
      await expectCode(store.head(bad), 'storage.invalid_key');
      await expectCode(store.readStart(bad, 8), 'storage.invalid_key');
      await expectCode(store.delete(bad), 'storage.invalid_key');
      await expectCode(store.createUploadTarget(upload(bad)), 'storage.invalid_key');
      await expectCode(store.createReadUrl({ key, expiresInSeconds: 60 }), 'storage.invalid_key');
    });

    it.each([
      ['an upper-case content type', { contentType: 'Image/PNG' }],
      ['a content type with parameters', { contentType: 'image/png; charset=x' }],
      ['a content type that injects a header', { contentType: 'image/png\r\nx-evil: 1' }],
      ['a zero size', { byteSize: 0 }],
      ['a fractional size', { byteSize: 1.5 }],
      ['a size above the single-upload limit', { byteSize: MAX_UPLOAD_BYTES + 1 }],
      ['a zero lifetime', { expiresInSeconds: 0 }],
      ['a lifetime above the maximum', { expiresInSeconds: MAX_SIGNED_URL_TTL_SECONDS + 1 }],
      ['a cache-control that injects a header', { cacheControl: 'public\r\nx-evil: 1' }],
    ])('refuses an upload with %s', async (_label, override) => {
      const subject = setup();
      const request = { ...upload(location(subject, 'public')), ...override };
      await expectCode(subject.store.createUploadTarget(request), 'storage.invalid_request');
    });

    it('stores what a client uploads and reports it truthfully', async () => {
      const subject = setup();
      const target = location(subject, 'public');
      expect(await expectOk(subject.store.head(target))).toBeNull();

      const signed = await expectOk(subject.store.createUploadTarget(upload(target)));
      expect(signed.kind).toBe('http-put');
      expect(signed.headers['content-type']).toBe('image/png');
      await subject.upload(signed, PNG);

      const stored = await expectOk(subject.store.head(target));
      expect(stored).toMatchObject({ byteSize: PNG.byteLength, contentType: 'image/png' });
      expect(Array.from(await expectOk(subject.store.readStart(target, 4)))).toEqual([
        0x89, 0x50, 0x4e, 0x47,
      ]);
      expect((await expectOk(subject.store.readStart(target, 1024))).byteLength).toBe(
        PNG.byteLength,
      );
    });

    it('reports a missing object as an answer for head and a failure for readStart', async () => {
      const subject = setup();
      const missing = location(subject, 'public');
      expect(await expectOk(subject.store.head(missing))).toBeNull();
      await expectCode(subject.store.readStart(missing, 8), 'storage.object_not_found');
    });

    it('deletes idempotently', async () => {
      const subject = setup();
      const target = location(subject, 'public');
      await subject.upload(await expectOk(subject.store.createUploadTarget(upload(target))), PNG);

      await expectOk(subject.store.delete(target));
      expect(await expectOk(subject.store.head(target))).toBeNull();
      await expectOk(subject.store.delete(target));
    });

    it('keeps the same key in each visibility a different object', async () => {
      const subject = setup();
      const key = `${subject.uniquePrefix()}/shared`;
      const inPublic: ObjectLocation = { visibility: 'public', key };
      const inPrivate: ObjectLocation = { visibility: 'private', key };
      await subject.upload(await expectOk(subject.store.createUploadTarget(upload(inPublic))), PNG);

      expect(await expectOk(subject.store.head(inPrivate))).toBeNull();
      await expectOk(subject.store.delete(inPrivate));
      expect(await expectOk(subject.store.head(inPublic))).not.toBeNull();
    });

    it('signs a read URL for a private object without checking that it exists', async () => {
      const { store } = setup();
      const url = await expectOk(
        store.createReadUrl({ key: 'private/anything', expiresInSeconds: 60 }),
      );
      expect(url).toMatch(/^https?:\/\//);
      expect(url).toContain('private/anything');
    });
  });
}
