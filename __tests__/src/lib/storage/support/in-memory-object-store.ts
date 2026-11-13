import type { Clock } from '@lib/clock';
import { err, errAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import {
  storageObjectNotFound,
  storageUnavailable,
  storageVisibilityUnavailable,
} from '@lib/storage';
import type {
  ObjectLocation,
  ObjectStore,
  ObjectVisibility,
  ReadUrlRequest,
  StorageError,
  StoredObject,
  UploadRequest,
  UploadTarget,
} from '@lib/storage';
import {
  validateObjectKey,
  validateReadStartBytes,
  validateReadUrlRequest,
  validateUploadRequest,
} from '@lib/storage/request-validation';

const ORIGIN = 'https://memory.storage.test';

interface Grant {
  readonly request: UploadRequest;
  readonly expiresAt: Date;
}

interface Entry {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly etag: string;
  readonly lastModified: Date;
}

export type StoreOperation =
  'createUploadTarget' | 'head' | 'readStart' | 'delete' | 'createReadUrl';

/** What a real store does when the client breaks the signed terms. */
export class UploadRefused extends Error {}

export interface InMemoryObjectStoreOptions {
  readonly clock: Clock;
  readonly visibilities?: readonly ObjectVisibility[];
  readonly publicBaseUrl?: string;
}

/**
 * A deterministic `ObjectStore` for tests. It enforces what the contract promises, including the
 * signed terms of an upload (exact content type, size, lifetime), so use cases can be tested
 * against realistic refusals. Like a real store it does NOT make a target single-use: a client
 * may upload again until `expiresAt`.
 */
export class InMemoryObjectStore implements ObjectStore {
  private readonly clock: Clock;
  private readonly visibilities: ReadonlySet<ObjectVisibility>;
  private readonly publicBaseUrl: string;
  private readonly grants = new Map<string, Grant>();
  private readonly objects = new Map<string, Entry>();
  private readonly failures = new Map<StoreOperation, StorageError>();
  private counter = 0;

  constructor(options: InMemoryObjectStoreOptions) {
    this.clock = options.clock;
    this.visibilities = new Set(options.visibilities ?? ['public', 'private']);
    this.publicBaseUrl = options.publicBaseUrl ?? 'https://media.example.test';
  }

  supports(visibility: ObjectVisibility): boolean {
    return this.visibilities.has(visibility);
  }

  publicUrl(key: string): string | null {
    if (!this.supports('public') || validateObjectKey(key).isErr()) {
      return null;
    }
    return `${this.publicBaseUrl}/${key}`;
  }

  createUploadTarget(request: UploadRequest): AppResultAsync<UploadTarget, StorageError> {
    return this.run<UploadTarget>('createUploadTarget', () => {
      const valid = validateUploadRequest(request);
      if (valid.isErr()) {
        return err(valid.error);
      }
      const unsupported = this.unsupported(request.location);
      if (unsupported) {
        return err(unsupported);
      }

      const expiresAt = new Date(this.clock.now().getTime() + request.expiresInSeconds * 1000);
      const id = `grant-${(this.counter += 1)}`;
      this.grants.set(id, { request, expiresAt });
      return ok({
        kind: 'http-put',
        url: `${ORIGIN}/upload/${id}`,
        headers: {
          'content-type': request.contentType,
          'cache-control': request.cacheControl,
        },
        expiresAt,
      });
    });
  }

  head(location: ObjectLocation): AppResultAsync<StoredObject | null, StorageError> {
    return this.run<StoredObject | null>('head', () => {
      const checked = this.check(location);
      if (checked) {
        return err(checked);
      }
      const entry = this.objects.get(slot(location));
      return ok(
        entry
          ? {
              byteSize: entry.bytes.byteLength,
              contentType: entry.contentType,
              etag: entry.etag,
              lastModified: entry.lastModified,
            }
          : null,
      );
    });
  }

  readStart(location: ObjectLocation, byteCount: number): AppResultAsync<Uint8Array, StorageError> {
    return this.run<Uint8Array>('readStart', () => {
      const checked = this.check(location);
      if (checked) {
        return err(checked);
      }
      const count = validateReadStartBytes(byteCount);
      if (count.isErr()) {
        return err(count.error);
      }
      const entry = this.objects.get(slot(location));
      return entry ? ok(entry.bytes.slice(0, byteCount)) : err(storageObjectNotFound());
    });
  }

  delete(location: ObjectLocation): AppResultAsync<void, StorageError> {
    return this.run<undefined>('delete', () => {
      const checked = this.check(location);
      if (checked) {
        return err(checked);
      }
      this.objects.delete(slot(location));
      return ok(undefined);
    });
  }

  createReadUrl(request: ReadUrlRequest): AppResultAsync<string, StorageError> {
    return this.run<string>('createReadUrl', () => {
      const valid = validateReadUrlRequest(request);
      if (valid.isErr()) {
        return err(valid.error);
      }
      if (!this.supports('private')) {
        return err(storageVisibilityUnavailable('private'));
      }
      const expires = this.clock.now().getTime() + request.expiresInSeconds * 1000;
      return ok(`${ORIGIN}/read/private/${request.key}?expires=${expires}`);
    });
  }

  // --- test controls: not part of `ObjectStore` -------------------------------------------

  /** What the browser does with an upload target. Throws `UploadRefused` where a real store answers 403. */
  simulateClientUpload(
    target: UploadTarget,
    upload: { body: Uint8Array; headers?: Readonly<Record<string, string>> },
  ): void {
    const grant = this.grants.get(target.url.slice(target.url.lastIndexOf('/') + 1));
    if (!grant) {
      throw new UploadRefused('Unknown or foreign upload target.');
    }
    if (this.clock.now().getTime() >= grant.expiresAt.getTime()) {
      throw new UploadRefused('The upload target has expired.');
    }
    const sent = upload.headers ?? target.headers;
    for (const [name, value] of Object.entries(target.headers)) {
      if (sent[name] !== value) {
        throw new UploadRefused(`Header ${name} differs from the signed one.`);
      }
    }
    if (upload.body.byteLength !== grant.request.byteSize) {
      throw new UploadRefused('The body size differs from the signed size.');
    }
    this.objects.set(slot(grant.request.location), {
      bytes: upload.body.slice(),
      contentType: grant.request.contentType,
      etag: `"etag-${(this.counter += 1)}"`,
      lastModified: this.clock.now(),
    });
  }

  /** Puts an object in place directly, as if a client had uploaded it earlier. */
  seed(location: ObjectLocation, bytes: Uint8Array, contentType: string): void {
    this.objects.set(slot(location), {
      bytes: bytes.slice(),
      contentType,
      etag: `"etag-${(this.counter += 1)}"`,
      lastModified: this.clock.now(),
    });
  }

  /** Makes the next call of one operation fail, once, like a provider outage. */
  failNext(
    operation: StoreOperation,
    error: StorageError = storageUnavailable(new Error('outage')),
  ): void {
    this.failures.set(operation, error);
  }

  has(location: ObjectLocation): boolean {
    return this.objects.has(slot(location));
  }

  get objectCount(): number {
    return this.objects.size;
  }

  // ------------------------------------------------------------------------------------------

  private run<T>(
    operation: StoreOperation,
    body: () => AppResult<T, StorageError>,
  ): AppResultAsync<T, StorageError> {
    const failure = this.failures.get(operation);
    if (failure) {
      this.failures.delete(operation);
      return errAsync(failure);
    }
    const result = body();
    return result.isOk() ? okAsync(result.value) : errAsync(result.error);
  }

  private check(location: ObjectLocation): StorageError | null {
    const key = validateObjectKey(location.key);
    if (key.isErr()) {
      return key.error;
    }
    return this.unsupported(location);
  }

  private unsupported(location: ObjectLocation): StorageError | null {
    return this.supports(location.visibility)
      ? null
      : storageVisibilityUnavailable(location.visibility);
  }
}

function slot(location: ObjectLocation): string {
  return `${location.visibility}:${location.key}`;
}
