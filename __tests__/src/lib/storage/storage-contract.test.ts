import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Clock } from '@lib/clock';
import type { StorageEnv } from '@lib/config/storage-env-schema';
import { infrastructureError, notFoundError, validationError } from '@lib/errors';
import { createObjectStore } from '@lib/storage/create-object-store';
import {
  validateObjectKey,
  validateReadStartBytes,
  validateUploadRequest,
} from '@lib/storage/request-validation';
import {
  STORAGE_ERROR_CODES,
  isRetryableStorageError,
  storageObjectNotFound,
  storageRejected,
  storageUnavailable,
  storageVisibilityUnavailable,
} from '@lib/storage/storage-errors';
import { MAX_OBJECT_KEY_LENGTH, MAX_READ_START_BYTES } from '@lib/storage/storage-limits';

const STORAGE_DIR = resolve(import.meta.dirname, '../../../../src/lib/storage');

describe('storage errors', () => {
  it('retries only a transient provider failure', () => {
    expect(isRetryableStorageError(storageUnavailable(new Error('503')))).toBe(true);
    for (const error of [
      storageRejected(new Error('403')),
      storageObjectNotFound(),
      storageVisibilityUnavailable('private'),
      validationError('x', 'x', {}),
    ]) {
      expect(isRetryableStorageError(error)).toBe(false);
    }
  });

  it('keeps the provider error as the cause and out of the message', () => {
    const cause = new Error('AccessDenied: arn:aws:iam::123:user/secret-name');
    const error = storageRejected(cause);

    expect(error).toMatchObject({
      kind: 'infrastructure',
      code: STORAGE_ERROR_CODES.rejected,
      cause,
    });
    expect(error.message).not.toContain('arn:aws');
  });

  it('uses the shared error kinds', () => {
    expect(storageObjectNotFound()).toEqual(
      notFoundError('storage.object_not_found', expect.any(String)),
    );
    expect(storageVisibilityUnavailable('public')).toMatchObject(
      infrastructureError('storage.visibility_unavailable', expect.any(String)),
    );
  });
});

describe('request validation', () => {
  it('accepts the keys a module derives from trusted ids', () => {
    for (const key of [
      'sites/0b6f/media/9c1d',
      'a',
      'a.b-c_d/e',
      '.hidden/file',
      'k'.repeat(MAX_OBJECT_KEY_LENGTH),
    ]) {
      expect(validateObjectKey(key).isOk(), key).toBe(true);
    }
  });

  it('counts the key length at the limit, not past it', () => {
    expect(validateObjectKey('k'.repeat(MAX_OBJECT_KEY_LENGTH + 1)).isErr()).toBe(true);
  });

  it('names the field that failed, for callers that show it', () => {
    const error = validateUploadRequest({
      location: { visibility: 'public', key: 'ok/key' },
      contentType: 'image/png',
      byteSize: 0,
      cacheControl: 'public',
      expiresInSeconds: 60,
    })._unsafeUnwrapErr();
    expect(error).toMatchObject({
      code: 'storage.invalid_request',
      fieldErrors: { byteSize: expect.any(Array) },
    });
  });

  it('bounds how much a caller may read back', () => {
    expect(validateReadStartBytes(MAX_READ_START_BYTES).isOk()).toBe(true);
    expect(validateReadStartBytes(MAX_READ_START_BYTES + 1).isErr()).toBe(true);
    expect(validateReadStartBytes(0).isErr()).toBe(true);
  });
});

const clock: Clock = { now: () => new Date('2026-10-18T10:00:00.000Z') };

const base: StorageEnv = {
  STORAGE_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
  STORAGE_S3_ACCESS_KEY_ID: 'id',
  STORAGE_S3_SECRET_ACCESS_KEY: 'secret',
};

describe('createObjectStore', () => {
  it('builds the S3 store for exactly the visibilities that have a bucket', () => {
    const store = createObjectStore(
      {
        ...base,
        STORAGE_S3_PUBLIC_BUCKET: 'civo-media-public',
        STORAGE_PUBLIC_BASE_URL: 'https://media.example.org/',
      },
      { clock },
    );

    expect(store.supports('public')).toBe(true);
    expect(store.supports('private')).toBe(false);
    expect(store.publicUrl('sites/s1/media/a1')).toBe(
      'https://media.example.org/sites/s1/media/a1',
    );
  });

  it('passes the private bucket, region and endpoint on, addressing the bucket by path', async () => {
    const store = createObjectStore(
      { ...base, STORAGE_S3_REGION: 'eu-central-1', STORAGE_S3_PRIVATE_BUCKET: 'civo-private' },
      { clock },
    );

    expect(store.supports('private')).toBe(true);
    expect(store.supports('public')).toBe(false);
    expect(store.publicUrl('a/b')).toBeNull();
    const url = await store.createReadUrl({ key: 'a/b', expiresInSeconds: 60 });
    const signed = new URL(url._unsafeUnwrap());
    expect(signed.origin).toBe('https://acct.r2.cloudflarestorage.com');
    expect(signed.pathname).toBe('/civo-private/a/b');
    expect(decodeURIComponent(signed.href)).toContain('/eu-central-1/s3/aws4_request');
  });

  it('assumes the region "auto" for a compatible service that names none', async () => {
    const store = createObjectStore(
      {
        ...base,
        STORAGE_S3_ENDPOINT: 'http://localhost:9000',
        STORAGE_S3_PRIVATE_BUCKET: 'civo-private',
      },
      { clock },
    );

    const url = await store.createReadUrl({ key: 'a/b', expiresInSeconds: 60 });
    expect(decodeURIComponent(url._unsafeUnwrap())).toContain('/auto/s3/aws4_request');
  });
});

describe('the storage boundary', () => {
  const sourceOf = (file: string) => readFileSync(resolve(STORAGE_DIR, file), 'utf8');

  it('names no module: the layer is generic, and modules depend on it, not the other way round', () => {
    for (const file of readdirSync(STORAGE_DIR)) {
      expect(sourceOf(file), file).not.toMatch(/from '@modules\//);
    }
  });

  it('keeps the provider adapter out of the port and its errors', () => {
    for (const file of ['object-store.ts', 'storage-errors.ts', 'storage-limits.ts', 'index.ts']) {
      expect(sourceOf(file), file).not.toMatch(/from '\.\/(s3-|sigv4|create-object-store)/);
    }
  });
});
