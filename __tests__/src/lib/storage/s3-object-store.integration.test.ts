// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { UploadTarget } from '@lib/storage';
import { S3ObjectStore } from '@lib/storage/s3-object-store';

import { describeObjectStoreContract } from './support/object-store-contract';

/**
 * Runs against a real S3-compatible service, such as the SeaweedFS of `docker compose --profile
 * storage up`. It uses its own `STORAGE_TEST_*` variables, never the application's `STORAGE_*`,
 * so it cannot write to a configured bucket by accident, and it refuses a non-local endpoint
 * unless `STORAGE_TEST_ALLOW_REMOTE=true`. Without a configuration the whole file is skipped
 * and reported as skipped, never as passed.
 */
const env = process.env;
const endpoint = env['STORAGE_TEST_S3_ENDPOINT'];
const accessKeyId = env['STORAGE_TEST_S3_ACCESS_KEY_ID'];
const secretAccessKey = env['STORAGE_TEST_S3_SECRET_ACCESS_KEY'];
const publicBucket = env['STORAGE_TEST_S3_PUBLIC_BUCKET'];
const privateBucket = env['STORAGE_TEST_S3_PRIVATE_BUCKET'];
const publicBaseUrl = env['STORAGE_TEST_PUBLIC_BASE_URL'];
const appOrigin = env['STORAGE_TEST_APP_ORIGIN'];

const configured = Boolean(
  endpoint && accessKeyId && secretAccessKey && publicBucket && privateBucket && publicBaseUrl,
);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'seaweedfs']);

if (configured && endpoint && !LOCAL_HOSTS.has(new URL(endpoint).hostname)) {
  if (env['STORAGE_TEST_ALLOW_REMOTE'] !== 'true') {
    throw new Error(
      'STORAGE_TEST_S3_ENDPOINT is not a local host. Set STORAGE_TEST_ALLOW_REMOTE=true to run against it.',
    );
  }
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
let run = 0;
const stamp = Date.now().toString(36);

function createStore() {
  return new S3ObjectStore({
    clock: { now: () => new Date() },
    region: env['STORAGE_TEST_S3_REGION'] ?? 'auto',
    endpoint: endpoint ?? '',
    accessKeyId: accessKeyId ?? '',
    secretAccessKey: secretAccessKey ?? '',
    ...(publicBucket ? { publicBucket } : {}),
    ...(privateBucket ? { privateBucket } : {}),
    ...(publicBaseUrl ? { publicBaseUrl } : {}),
  });
}

/** The browser's side of an upload: a plain PUT with the signed headers. */
async function put(
  target: UploadTarget,
  body: Uint8Array,
  headers = target.headers,
): Promise<Response> {
  return fetch(target.url, { method: 'PUT', headers: { ...headers }, body: body.slice() });
}

describe.skipIf(!configured)('S3ObjectStore against a real S3-compatible service', () => {
  describeObjectStoreContract('S3ObjectStore', () => ({
    store: createStore(),
    upload: async (target, body) => {
      const response = await put(target, body);
      if (!response.ok) {
        throw new Error(`The upload was refused with status ${response.status}`);
      }
    },
    uniquePrefix: () => `integration/${stamp}/${(run += 1)}`,
  }));

  const store = createStore();
  const key = () => `integration/${stamp}/terms-${(run += 1)}`;
  const request = (objectKey: string, visibility: 'public' | 'private' = 'public') => ({
    location: { visibility, key: objectKey },
    contentType: 'image/png',
    byteSize: PNG.byteLength,
    cacheControl: 'public, max-age=60',
    expiresInSeconds: 300,
  });

  it('refuses an upload whose size, type or cache-control differs from what was signed', async () => {
    const target = (await store.createUploadTarget(request(key())))._unsafeUnwrap();

    expect((await put(target, new Uint8Array(PNG.byteLength + 1))).status).toBe(403);
    expect(
      (await put(target, PNG, { ...target.headers, 'content-type': 'text/html' })).status,
    ).toBe(403);
    expect(
      (await put(target, PNG, { ...target.headers, 'cache-control': 'no-store' })).status,
    ).toBe(403);
  });

  it('refuses to write any other key with a signed URL', async () => {
    const target = (await store.createUploadTarget(request(key())))._unsafeUnwrap();
    const elsewhere = target.url.replace(/terms-\d+/, 'terms-other');
    expect((await put({ ...target, url: elsewhere }, PNG)).status).toBe(403);
  });

  it('stores the content type and cache-control it was given and serves them publicly', async () => {
    const objectKey = key();
    const target = (await store.createUploadTarget(request(objectKey)))._unsafeUnwrap();
    expect((await put(target, PNG)).ok).toBe(true);

    const response = await fetch(store.publicUrl(objectKey) ?? '');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it('keeps private objects off the public origin and readable only through a signed URL', async () => {
    const objectKey = key();
    const target = (await store.createUploadTarget(request(objectKey, 'private')))._unsafeUnwrap();
    expect((await put(target, PNG)).ok).toBe(true);

    expect((await fetch(`${publicBaseUrl ?? ''}/${objectKey}`)).status).not.toBe(200);
    const readUrl = (
      await store.createReadUrl({ key: objectKey, expiresInSeconds: 60 })
    )._unsafeUnwrap();
    expect((await fetch(readUrl)).status).toBe(200);
    expect((await fetch(readUrl.replace(objectKey, `${objectKey}-other`))).status).toBe(403);
  });

  it('refuses a read URL once it has expired', async () => {
    const objectKey = key();
    const target = (await store.createUploadTarget(request(objectKey, 'private')))._unsafeUnwrap();
    await put(target, PNG);
    const readUrl = (
      await store.createReadUrl({ key: objectKey, expiresInSeconds: 1 })
    )._unsafeUnwrap();

    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect((await fetch(readUrl)).status).toBe(403);
  });

  it.skipIf(!appOrigin)(
    'lets the application origin, and only it, upload from a browser',
    async () => {
      const target = (await store.createUploadTarget(request(key())))._unsafeUnwrap();
      const preflight = (origin: string) =>
        fetch(target.url, {
          method: 'OPTIONS',
          headers: {
            origin,
            'access-control-request-method': 'PUT',
            'access-control-request-headers': 'content-type,cache-control',
          },
        });

      expect((await preflight(appOrigin ?? '')).headers.get('access-control-allow-origin')).toBe(
        appOrigin,
      );
      expect(
        (await preflight('https://evil.example')).headers.get('access-control-allow-origin'),
      ).toBeNull();
    },
  );
});
