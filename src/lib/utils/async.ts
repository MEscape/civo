/**
 * Async helpers. Zero dependencies, no knowledge of what they wrap.
 */

/** Resolves after `ms` milliseconds. Not a substitute for a real scheduler. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Rejects with `TimeoutError` if the promise does not settle in time. It
 * cannot cancel the underlying work, so pair it with an `AbortSignal` when
 * cancellation matters.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export interface RetryOptions {
  /** Total attempts including the first. Default 3. */
  attempts?: number;
  /** Delay before the first retry; doubles each attempt. Default 200. */
  baseDelayMs?: number;
  /** Upper bound for a single delay. Default 5000. */
  maxDelayMs?: number;
  /** Return false to stop retrying for errors that will never succeed. Default retries everything. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Retries an async operation with exponential backoff. It knows nothing
 * about `Result`: it rethrows the last error once attempts are exhausted,
 * and the infrastructure caller wraps that outcome in a `Result` itself
 * (errors.md).
 */
export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs = 200, maxDelayMs = 5000, shouldRetry = () => true } = options;

  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError('retryWithBackoff: attempts must be a positive integer');
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (thrown) {
      lastError = thrown;
      const isLast = attempt === attempts;
      if (isLast || !shouldRetry(thrown, attempt)) {
        break;
      }
      await sleep(Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs));
    }
  }
  throw lastError;
}

/**
 * Runs `fn` over `items` with at most `concurrency` calls in flight,
 * preserving result order. Rejects on the first failure.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('mapWithConcurrency: concurrency must be a positive integer');
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index] as T, index); // index < items.length is checked by the loop.
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
