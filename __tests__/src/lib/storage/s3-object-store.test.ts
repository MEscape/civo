// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { S3ObjectStore } from '@lib/storage/s3-object-store';
import type { S3ObjectStoreOptions } from '@lib/storage/s3-object-store';

const NOW = new Date('2026-10-18T10:00:00.000Z');
const SECRET = 'super-secret-access-key';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

type Responder = (request: Request) => Response | Promise<Response>;

/** Records every request the adapter makes and answers from `responders` in order (the last repeats). */
function harness(
  responders: Responder[],
  overrides: Partial<S3ObjectStoreOptions> = {},
  omit: ReadonlyArray<keyof S3ObjectStoreOptions> = [],
) {
  const requests: Request[] = [];
  let call = 0;
  const fetchStub: typeof fetch = async (input) => {
    const request = input as Request;
    requests.push(request);
    const respond = responders[Math.min(call, responders.length - 1)];
    call += 1;
    return respond ? respond(request) : new Response(null, { status: 500 });
  };
  const options: S3ObjectStoreOptions = {
    clock: { now: () => NOW },
    region: 'auto',
    endpoint: 'https://acct.r2.cloudflarestorage.com',
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: SECRET,
    publicBucket: 'civo-media-public',
    privateBucket: 'civo-media-private',
    publicBaseUrl: 'https://media.example.org',
    fetch: fetchStub,
    retryDelayMs: 0,
    ...overrides,
  };
  for (const key of omit) {
    Reflect.deleteProperty(options, key);
  }
  return { store: new S3ObjectStore(options), requests };
}

const status =
  (code: number, body?: string, headers?: Record<string, string>): Responder =>
  () =>
    new Response(body ?? null, { status: code, ...(headers ? { headers } : {}) });
const s3Error = (code: number, errorCode: string) =>
  status(
    code,
    `<?xml version="1.0"?><Error><Code>${errorCode}</Code><Message>nope</Message></Error>`,
  );

const PUBLIC = { visibility: 'public', key: 'sites/s1/media/a1' } as const;
const PRIVATE = { visibility: 'private', key: 'docs/d1' } as const;
const upload = {
  location: PUBLIC,
  contentType: 'image/png',
  byteSize: PNG.byteLength,
  cacheControl: 'public, max-age=31536000, immutable',
  expiresInSeconds: 300,
};

describe('S3ObjectStore: addressing', () => {
  it('addresses the bucket as a path segment, never as a sub-domain', async () => {
    const { store, requests } = harness([status(404)]);
    await store.head(PUBLIC);
    expect(requests[0]!.url).toBe(
      'https://acct.r2.cloudflarestorage.com/civo-media-public/sites/s1/media/a1',
    );
  });

  it('keeps a path the endpoint already has, and a trailing slash does not double up', async () => {
    const { store, requests } = harness([status(404)], { endpoint: 'http://127.0.0.1:8333/s3/' });
    await store.head(PUBLIC);
    expect(requests[0]!.url).toBe('http://127.0.0.1:8333/s3/civo-media-public/sites/s1/media/a1');
  });

  it('serves public URLs from the configured origin, with or without a trailing slash', () => {
    const { store } = harness([], { publicBaseUrl: 'https://media.example.org/' });
    expect(store.publicUrl('sites/s1/media/a1')).toBe(
      'https://media.example.org/sites/s1/media/a1',
    );
    expect(store.publicUrl('../x')).toBeNull();
  });

  it('knows which visibilities it has a bucket for, and refuses the other without calling out', async () => {
    const { store, requests } = harness([status(200)], {}, ['privateBucket']);
    expect(store.supports('private')).toBe(false);
    expect(store.publicUrl('a')).not.toBeNull();

    const result = await store.head(PRIVATE);
    expect(result._unsafeUnwrapErr().code).toBe('storage.visibility_unavailable');
    expect(requests).toHaveLength(0);

    const privateOnly = harness([], {}, ['publicBucket', 'publicBaseUrl']);
    expect(privateOnly.store.publicUrl('a')).toBeNull();
  });
});

describe('S3ObjectStore: upload targets', () => {
  it('pins content type, size and cache-control into the signature', async () => {
    const { store, requests } = harness([]);
    const target = (await store.createUploadTarget(upload))._unsafeUnwrap();
    const url = new URL(target.url);

    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
      'cache-control;content-length;content-type;host',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261018T100000Z');
    expect(target.headers).toEqual({
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    });
    expect(target.expiresAt).toEqual(new Date('2026-10-18T10:05:00.000Z'));
    expect(requests).toHaveLength(0);
  });

  it('adds no checksum parameters, which several S3-compatible services reject', async () => {
    const { store } = harness([]);
    const target = (await store.createUploadTarget(upload))._unsafeUnwrap();
    const names = [...new URL(target.url).searchParams.keys()].join(' ').toLowerCase();
    expect(names).not.toMatch(/checksum|x-id/);
  });

  it('never puts the secret or the signing key material in the URL', async () => {
    const { store } = harness([]);
    const target = (await store.createUploadTarget(upload))._unsafeUnwrap();
    expect(target.url).not.toContain(SECRET);
  });

  it('signs a different URL for every key', async () => {
    const { store } = harness([]);
    const a = (await store.createUploadTarget(upload))._unsafeUnwrap();
    const b = (
      await store.createUploadTarget({
        ...upload,
        location: { ...PUBLIC, key: 'sites/s1/media/a2' },
      })
    )._unsafeUnwrap();
    expect(new URL(a.url).searchParams.get('X-Amz-Signature')).not.toBe(
      new URL(b.url).searchParams.get('X-Amz-Signature'),
    );
  });

  it('refuses an invalid request before signing anything', async () => {
    const { store } = harness([]);
    expect(
      (await store.createUploadTarget({ ...upload, byteSize: 0 }))._unsafeUnwrapErr().code,
    ).toBe('storage.invalid_request');
  });
});

describe('S3ObjectStore: read URLs', () => {
  it('signs a short-lived GET for the private bucket only', async () => {
    const { store } = harness([]);
    const url = new URL(
      (await store.createReadUrl({ key: 'docs/d1', expiresInSeconds: 60 }))._unsafeUnwrap(),
    );

    expect(url.origin + url.pathname).toBe(
      'https://acct.r2.cloudflarestorage.com/civo-media-private/docs/d1',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.href).not.toContain(SECRET);
  });
});

describe('S3ObjectStore: head', () => {
  it('reports what the store knows about an object', async () => {
    const { store } = harness([
      status(200, undefined, {
        'content-length': '12',
        'content-type': 'image/png',
        etag: '"abc"',
        'last-modified': 'Sun, 18 Oct 2026 09:00:00 GMT',
      }),
    ]);
    expect((await store.head(PUBLIC))._unsafeUnwrap()).toEqual({
      byteSize: 12,
      contentType: 'image/png',
      etag: '"abc"',
      lastModified: new Date('2026-10-18T09:00:00.000Z'),
    });
  });

  it('answers a missing object with null, not an error', async () => {
    const { store } = harness([status(404)]);
    expect((await store.head(PUBLIC))._unsafeUnwrap()).toBeNull();
  });

  it('sends an authorization header and never the secret', async () => {
    const { store, requests } = harness([status(404)]);
    await store.head(PUBLIC);
    const headers = requests[0]!.headers;
    expect(headers.get('authorization')).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20261018\/auto\/s3\//,
    );
    expect([...headers.values()].join(' ')).not.toContain(SECRET);
  });
});

describe('S3ObjectStore: failures', () => {
  it('does not retry what retrying cannot fix', async () => {
    const { store, requests } = harness([s3Error(403, 'AccessDenied')]);
    const error = (await store.head(PUBLIC))._unsafeUnwrapErr();

    expect(error.code).toBe('storage.rejected');
    expect(requests).toHaveLength(1);
  });

  it('retries a transient failure and succeeds when the provider recovers', async () => {
    const { store, requests } = harness([status(503), status(429), status(404)]);
    expect((await store.head(PUBLIC))._unsafeUnwrap()).toBeNull();
    expect(requests).toHaveLength(3);
  });

  it('gives up after the bounded number of attempts and reports the outage as retryable', async () => {
    const { store, requests } = harness([status(503)], { attempts: 3 });
    const error = (await store.head(PUBLIC))._unsafeUnwrapErr();

    expect(error.code).toBe('storage.unavailable');
    expect(requests).toHaveLength(3);
  });

  it('treats a network failure or timeout as transient', async () => {
    const { store } = harness(
      [
        () => {
          throw new DOMException('timed out', 'TimeoutError');
        },
      ],
      { attempts: 1 },
    );
    expect((await store.head(PUBLIC))._unsafeUnwrapErr().code).toBe('storage.unavailable');
  });

  it('keeps URLs, signatures and the secret out of every error it returns', async () => {
    const { store } = harness([s3Error(403, 'SignatureDoesNotMatch')]);
    const error = (await store.head(PUBLIC))._unsafeUnwrapErr();
    const text = `${error.message} ${String((error as { cause?: unknown }).cause)}`;

    expect(text).toContain('403');
    expect(text).toContain('SignatureDoesNotMatch');
    expect(text).not.toMatch(/X-Amz|acct\.r2|civo-media|a1|AKIDEXAMPLE/);
    expect(text).not.toContain(SECRET);
  });
});

describe('S3ObjectStore: readStart', () => {
  it('asks for a byte range and returns what came back', async () => {
    const { store, requests } = harness([status(206, 'abcd')]);
    const bytes = (await store.readStart(PUBLIC, 4))._unsafeUnwrap();

    expect(requests[0]!.headers.get('range')).toBe('bytes=0-3');
    expect(new TextDecoder().decode(bytes)).toBe('abcd');
  });

  it('never returns more than asked for, even when the server ignores the range', async () => {
    const { store } = harness([status(200, 'abcdefghij')]);
    expect((await store.readStart(PUBLIC, 4))._unsafeUnwrap()).toHaveLength(4);
  });

  it('returns what an object has when it is shorter than the range', async () => {
    const { store } = harness([status(206, 'ab')]);
    expect((await store.readStart(PUBLIC, 64))._unsafeUnwrap()).toHaveLength(2);
  });

  it('reports a missing object as not found and an empty one as empty', async () => {
    expect((await harness([status(404)]).store.readStart(PUBLIC, 4))._unsafeUnwrapErr().code).toBe(
      'storage.object_not_found',
    );
    expect((await harness([status(416)]).store.readStart(PUBLIC, 4))._unsafeUnwrap()).toHaveLength(
      0,
    );
  });

  it('refuses to read back more than the limit', async () => {
    const { store, requests } = harness([status(206, 'x')]);
    expect((await store.readStart(PUBLIC, 1_000_000))._unsafeUnwrapErr().code).toBe(
      'storage.invalid_request',
    );
    expect(requests).toHaveLength(0);
  });
});

describe('S3ObjectStore: delete', () => {
  it('succeeds whether the object existed or not', async () => {
    expect((await harness([status(204)]).store.delete(PUBLIC)).isOk()).toBe(true);
    expect((await harness([status(404)]).store.delete(PUBLIC)).isOk()).toBe(true);
  });

  it('reports a refusal and a transient outage differently', async () => {
    expect(
      (await harness([s3Error(403, 'AccessDenied')]).store.delete(PUBLIC))._unsafeUnwrapErr().code,
    ).toBe('storage.rejected');
    expect(
      (await harness([status(500)], { attempts: 1 }).store.delete(PUBLIC))._unsafeUnwrapErr().code,
    ).toBe('storage.unavailable');
  });
});

describe('S3ObjectStore: a malformed key never leaves the process', () => {
  const BAD = { visibility: 'public', key: '../escape' } as const;

  it.each([
    ['head', (store: S3ObjectStore) => store.head(BAD)],
    ['readStart', (store: S3ObjectStore) => store.readStart(BAD, 4)],
    ['delete', (store: S3ObjectStore) => store.delete(BAD)],
    [
      'createUploadTarget',
      (store: S3ObjectStore) => store.createUploadTarget({ ...upload, location: BAD }),
    ],
    [
      'createReadUrl',
      (store: S3ObjectStore) => store.createReadUrl({ key: '../x', expiresInSeconds: 60 }),
    ],
  ])('%s refuses it without a request', async (_name, run) => {
    const { store, requests } = harness([status(200)]);

    expect((await run(store))._unsafeUnwrapErr().code).toBe('storage.invalid_key');
    expect(requests).toHaveLength(0);
  });

  it('refuses an upload for a visibility without a bucket, without signing anything', async () => {
    const { store, requests } = harness([], {}, ['publicBucket']);

    const error = (await store.createUploadTarget(upload))._unsafeUnwrapErr();

    expect(error.code).toBe('storage.visibility_unavailable');
    expect(requests).toHaveLength(0);
  });
});

describe('S3ObjectStore: unexpected failures', () => {
  it('reports a throw inside the adapter as a rejection, without its message', async () => {
    const { store } = harness([status(200)], {
      clock: {
        now: () => {
          throw new Error(`clock exploded near ${SECRET}`);
        },
      },
    });

    const error = (await store.head(PUBLIC))._unsafeUnwrapErr();

    expect(error.code).toBe('storage.rejected');
    expect(`${error.message} ${String((error as { cause?: unknown }).cause)}`).not.toContain(
      SECRET,
    );
  });

  it('retries a body that is cut off after the headers arrived', async () => {
    const cutOff = () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(new DOMException('reset', 'AbortError'));
          },
        }),
        { status: 206 },
      );
    const { store, requests } = harness([cutOff, status(206, 'abcd')]);

    expect(new TextDecoder().decode((await store.readStart(PUBLIC, 4))._unsafeUnwrap())).toBe(
      'abcd',
    );
    expect(requests).toHaveLength(2);
  });

  it('reports a body that stays cut off as a retryable outage', async () => {
    const cutOff = () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(new Error('reset'));
          },
        }),
        { status: 206 },
      );
    const { store } = harness([cutOff], { attempts: 2 });

    expect((await store.readStart(PUBLIC, 4))._unsafeUnwrapErr().code).toBe('storage.unavailable');
  });

  it('returns nothing for an answer without a body, and survives a stream that refuses to close', async () => {
    const noBody = harness([() => new Response(null, { status: 200 })]);
    expect((await noBody.store.readStart(PUBLIC, 4))._unsafeUnwrap()).toHaveLength(0);

    const stubborn = () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('abcdefgh'));
          },
          cancel() {
            throw new Error('will not close');
          },
        }),
        { status: 200 },
      );
    const { store } = harness([stubborn]);
    expect(new TextDecoder().decode((await store.readStart(PUBLIC, 4))._unsafeUnwrap())).toBe(
      'abcd',
    );
  });
});

describe('S3ObjectStore: what the provider sends back', () => {
  it('copes with missing or malformed metadata', async () => {
    const { store } = harness([
      status(200, undefined, { 'content-length': 'many', 'last-modified': 'yesterday-ish' }),
    ]);

    expect((await store.head(PUBLIC))._unsafeUnwrap()).toEqual({
      byteSize: 0,
      contentType: null,
      etag: null,
      lastModified: null,
    });
    expect((await harness([status(200)]).store.head(PUBLIC))._unsafeUnwrap()).toMatchObject({
      byteSize: 0,
    });
  });

  it.each([408, 425, 429, 500, 503])('treats status %i as worth retrying', async (code) => {
    const { store } = harness([status(code)], { attempts: 1 });
    expect((await store.head(PUBLIC))._unsafeUnwrapErr().code).toBe('storage.unavailable');
  });

  it('names no provider code when the error body has none, or is unreadable', async () => {
    const plain = harness([status(403, 'Forbidden')]);
    const error = (await plain.store.head(PUBLIC))._unsafeUnwrapErr();
    expect(String((error as { cause?: unknown }).cause)).toBe(
      'Error: S3 HEAD failed with status 403',
    );

    const broken = harness([
      () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.error(new Error('reset'));
            },
          }),
          { status: 403 },
        ),
    ]);
    expect((await broken.store.head(PUBLIC))._unsafeUnwrapErr().code).toBe('storage.rejected');
  });
});

describe('S3ObjectStore: defaults', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the platform fetch, and three attempts with doubling pauses', async () => {
    const platformFetch = vi.fn(() => Promise.resolve(new Response(null, { status: 503 })));
    vi.stubGlobal('fetch', platformFetch);
    const store = new S3ObjectStore({
      clock: { now: () => NOW },
      region: 'auto',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: SECRET,
      publicBucket: 'civo-media-public',
    });
    const started = Date.now();

    expect((await store.head(PUBLIC))._unsafeUnwrapErr().code).toBe('storage.unavailable');

    expect(platformFetch).toHaveBeenCalledTimes(3);
    expect(Date.now() - started).toBeGreaterThanOrEqual(550);
  });
});

describe('S3ObjectStore: every operation reports what went wrong', () => {
  const unreachable = () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- a non-Error rejection is what is tested
    throw 'connection refused';
  };

  it('treats an unreachable store as a transient outage, whatever was thrown', async () => {
    const { store } = harness([unreachable], { attempts: 1 });

    for (const outcome of [
      await store.readStart(PUBLIC, 4),
      await store.delete(PUBLIC),
      await store.head(PUBLIC),
    ]) {
      expect(outcome._unsafeUnwrapErr().code).toBe('storage.unavailable');
    }
  });

  it('reports a refused read of the first bytes as a rejection', async () => {
    const { store } = harness([s3Error(403, 'AccessDenied')]);
    expect((await store.readStart(PUBLIC, 4))._unsafeUnwrapErr().code).toBe('storage.rejected');
  });

  it('refuses a read URL when there is no private bucket, or a lifetime that is no good', async () => {
    const noPrivate = harness([], {}, ['privateBucket']);
    expect(
      (
        await noPrivate.store.createReadUrl({ key: 'docs/d1', expiresInSeconds: 60 })
      )._unsafeUnwrapErr().code,
    ).toBe('storage.visibility_unavailable');

    const { store } = harness([]);
    expect(
      (await store.createReadUrl({ key: 'docs/d1', expiresInSeconds: 0 }))._unsafeUnwrapErr().code,
    ).toBe('storage.invalid_request');
  });
});
