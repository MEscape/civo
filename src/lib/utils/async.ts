/**
 * Async helpers. Zero dependencies, no knowledge of what they wrap.
 */

/** Thrown by `withTimeout`; `timeoutMs` is the limit that was exceeded. */
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Rejects with `TimeoutError` if the promise does not settle within `timeoutMs`. It cannot cancel
 * the underlying work, so pair it with an `AbortSignal` when cancellation matters: the abandoned
 * promise keeps running, and a later rejection of it is swallowed rather than reported as
 * unhandled. The timer is always cleared, so a settled call leaves nothing pending.
 *
 * @throws TimeoutError when the limit passes first; otherwise whatever the promise throws
 * @example await withTimeout(store.hit(key), 1500);
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
