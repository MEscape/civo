import type { Clock } from '@lib/clock';
import { err, ok, ResultAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import { MS_PER_SECOND, retry, stripTrailingSlash } from '@lib/utils';

import {
  validateObjectKey,
  validateReadStartBytes,
  validateReadUrlRequest,
  validateUploadRequest,
} from './request-validation';
import {
  NOT_FOUND,
  RANGE_NOT_SATISFIABLE,
  describeObject,
  errorName,
  readAtMost,
  s3Failure,
  transportFailure,
} from './s3-responses';
import { presignUrl, signRequest } from './sigv4';
import {
  isRetryableStorageError,
  storageObjectNotFound,
  storageRejected,
  storageVisibilityUnavailable,
} from './storage-errors';

import type {
  ObjectLocation,
  ObjectStore,
  ObjectVisibility,
  ReadUrlRequest,
  StoredObject,
  UploadRequest,
  UploadTarget,
} from './object-store';
import type { SigV4Credentials } from './sigv4';
import type { StorageError } from './storage-errors';

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 200;

export interface S3ObjectStoreOptions {
  readonly clock: Clock;
  /** The region the service signs for: Neon hands out its own, most others accept `auto`. */
  readonly region: string;
  /** The S3 API of the service, addressed as `endpoint/bucket/key` (path style). */
  readonly endpoint: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly publicBucket?: string;
  readonly privateBucket?: string;
  /** Where the public bucket is served from; the origin, not the S3 API. */
  readonly publicBaseUrl?: string;
  /** Replaceable for tests. */
  readonly fetch?: typeof fetch;
  readonly requestTimeoutMs?: number;
  readonly attempts?: number;
  readonly retryDelayMs?: number;
}

type Outcome<T> = AppResult<T, StorageError>;

/**
 * `ObjectStore` over the S3 protocol, spoken directly with SigV4 signing (`sigv4.ts`) instead of
 * a vendor SDK, so it adds no dependency. Production is Neon Object Storage; the same code serves
 * any S3-compatible service that supports path-style addressing (Neon supports nothing else),
 * such as the SeaweedFS container in `docker-compose.yml`. Retries are bounded and explicit.
 *
 * Credentials are explicit and never taken from the environment's ambient credential chain.
 * Signed URLs and credentials appear in no error, log line or `cause`.
 */
export class S3ObjectStore implements ObjectStore {
  private readonly credentials: SigV4Credentials;
  private readonly send: typeof fetch;
  private readonly buckets: Readonly<Record<ObjectVisibility, string | undefined>>;
  private readonly publicBase: string | null;

  constructor(private readonly options: S3ObjectStoreOptions) {
    this.credentials = {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region,
    };
    this.send = options.fetch ?? fetch;
    this.buckets = { public: options.publicBucket, private: options.privateBucket };
    this.publicBase =
      options.publicBucket && options.publicBaseUrl
        ? stripTrailingSlash(options.publicBaseUrl)
        : null;
  }

  supports(visibility: ObjectVisibility): boolean {
    return this.buckets[visibility] !== undefined;
  }

  publicUrl(key: string): string | null {
    if (this.publicBase === null || validateObjectKey(key).isErr()) {
      return null;
    }
    return `${this.publicBase}/${key}`;
  }

  createUploadTarget(request: UploadRequest): AppResultAsync<UploadTarget, StorageError> {
    return this.settle(() => {
      const valid = validateUploadRequest(request);
      if (valid.isErr()) {
        return err(valid.error);
      }
      const url = this.urlFor(request.location);
      if (url.isErr()) {
        return err(url.error);
      }

      const signedUrl = presignUrl(this.credentials, {
        method: 'PUT',
        url: url.value,
        // Signing these pins them: the store refuses an upload that differs in any of the three.
        headers: {
          'content-type': request.contentType,
          'content-length': String(request.byteSize),
          'cache-control': request.cacheControl,
        },
        now: this.options.clock.now(),
        expiresInSeconds: request.expiresInSeconds,
      });
      return ok<UploadTarget>({
        kind: 'http-put',
        url: signedUrl,
        // Content-Length is the client's HTTP stack's to set, from the body it sends.
        headers: { 'content-type': request.contentType, 'cache-control': request.cacheControl },
        expiresAt: new Date(
          this.options.clock.now().getTime() + request.expiresInSeconds * MS_PER_SECOND,
        ),
      });
    });
  }

  head(location: ObjectLocation): AppResultAsync<StoredObject | null, StorageError> {
    return this.settle(() =>
      this.withRetry(async () => {
        const url = this.urlFor(location);
        if (url.isErr()) {
          return err(url.error);
        }
        const response = await this.call('HEAD', this.sign('HEAD', url.value));
        if (response.isErr()) {
          return err(response.error);
        }
        if (response.value.status === NOT_FOUND) {
          return ok(null);
        }
        if (!response.value.ok) {
          return err(await s3Failure('HEAD', response.value));
        }
        return ok(describeObject(response.value));
      }),
    );
  }

  readStart(location: ObjectLocation, byteCount: number): AppResultAsync<Uint8Array, StorageError> {
    return this.settle(() =>
      this.withRetry(async () => {
        const count = validateReadStartBytes(byteCount);
        if (count.isErr()) {
          return err(count.error);
        }
        const url = this.urlFor(location);
        if (url.isErr()) {
          return err(url.error);
        }

        const response = await this.call(
          'GET',
          this.sign('GET', url.value, { range: `bytes=0-${byteCount - 1}` }),
        );
        if (response.isErr()) {
          return err(response.error);
        }
        if (response.value.status === NOT_FOUND) {
          return err(storageObjectNotFound());
        }
        // An empty object cannot satisfy any range.
        if (response.value.status === RANGE_NOT_SATISFIABLE) {
          return ok(new Uint8Array());
        }
        if (!response.value.ok) {
          return err(await s3Failure('GET', response.value));
        }
        try {
          return ok(await readAtMost(response.value, byteCount));
        } catch (cause) {
          // The body can be cut off after the headers arrived.
          return err(transportFailure('GET', cause));
        }
      }),
    );
  }

  delete(location: ObjectLocation): AppResultAsync<void, StorageError> {
    return this.settle(() =>
      this.withRetry(async () => {
        const url = this.urlFor(location);
        if (url.isErr()) {
          return err(url.error);
        }
        const response = await this.call('DELETE', this.sign('DELETE', url.value));
        if (response.isErr()) {
          return err(response.error);
        }
        // Deleting what is already gone is a success.
        if (response.value.ok || response.value.status === NOT_FOUND) {
          return ok(undefined);
        }
        return err(await s3Failure('DELETE', response.value));
      }),
    );
  }

  createReadUrl(request: ReadUrlRequest): AppResultAsync<string, StorageError> {
    return this.settle(() => {
      const valid = validateReadUrlRequest(request);
      if (valid.isErr()) {
        return err(valid.error);
      }
      const url = this.urlFor({ visibility: 'private', key: request.key });
      if (url.isErr()) {
        return err(url.error);
      }
      return ok(
        presignUrl(this.credentials, {
          method: 'GET',
          url: url.value,
          now: this.options.clock.now(),
          expiresInSeconds: request.expiresInSeconds,
        }),
      );
    });
  }

  private settle<T>(run: () => Outcome<T> | Promise<Outcome<T>>): AppResultAsync<T, StorageError> {
    return new ResultAsync(
      // Nothing in `run` is expected to throw; if it does, say so without the cause's message.
      Promise.resolve()
        .then(run)
        .catch((cause: unknown) =>
          err(storageRejected(new Error(`S3 request failed unexpectedly: ${errorName(cause)}`))),
        ),
    );
  }

  /** Repeats an idempotent request, with doubling pauses, while the provider reports a transient failure. */
  private withRetry<T>(attempt: () => Promise<Outcome<T>>): Promise<Outcome<T>> {
    const baseDelayMs = this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    return retry(attempt, {
      attempts: this.options.attempts ?? DEFAULT_ATTEMPTS,
      shouldRetry: (outcome) => outcome.isErr() && isRetryableStorageError(outcome.error),
      delayMs: (made) => baseDelayMs * 2 ** (made - 1),
    });
  }

  private urlFor(location: ObjectLocation): Outcome<URL> {
    const key = validateObjectKey(location.key);
    if (key.isErr()) {
      return err(key.error);
    }
    const bucket = this.buckets[location.visibility];
    if (bucket === undefined) {
      return err(storageVisibilityUnavailable(location.visibility));
    }

    // Path style only: Neon Object Storage does not serve `bucket.host`.
    const url = new URL(this.options.endpoint);
    url.pathname = `${stripTrailingSlash(url.pathname)}/${bucket}/${location.key}`;
    return ok(url);
  }

  /** A request authenticated by header, for the calls this process makes itself. */
  private sign(method: string, url: URL, headers?: Record<string, string>): Request {
    return signRequest(this.credentials, {
      method,
      url,
      now: this.options.clock.now(),
      ...(headers ? { headers } : {}),
    });
  }

  private async call(operation: string, request: Request): Promise<Outcome<Response>> {
    try {
      return ok(
        await this.send(request, {
          signal: AbortSignal.timeout(this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS),
        }),
      );
    } catch (cause) {
      return err(transportFailure(operation, cause));
    }
  }
}
