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

/** When and how often `retry` runs an attempt again. */
export interface RetryOptions<T> {
  /** The most times the attempt runs, the first included. */
  readonly attempts: number;
  /** Whether this outcome is worth another attempt (a transient failure, not a refusal). */
  readonly shouldRetry: (outcome: T) => boolean;
  /** The pause before the next attempt, given how many have run so far (1 after the first). */
  readonly delayMs: (attemptsMade: number) => number;
}

/**
 * Runs `attempt` again while its outcome says another try may help, up to `attempts` times, and
 * returns the last outcome. It judges the returned value, so an attempt that reports failure as a
 * `Result` is retried without throwing; an attempt that throws is not caught, the throw ends the
 * retries. Only retry an operation that is safe to repeat.
 *
 * @example await retry(() => store.head(key), { attempts: 3, shouldRetry: isTransient, delayMs: (n) => 200 * 2 ** (n - 1) });
 */
export async function retry<T>(
  attempt: () => Promise<T>,
  { attempts, shouldRetry, delayMs }: RetryOptions<T>,
): Promise<T> {
  let outcome = await attempt();
  for (let made = 1; made < attempts && shouldRetry(outcome); made += 1) {
    await sleep(delayMs(made));
    outcome = await attempt();
  }
  return outcome;
}

/**
 * Resolves after `ms` milliseconds. Not cancellable: it is for pauses between retries, where
 * finishing the pause is harmless. Use an `AbortSignal` when the wait itself must be abortable.
 *
 * @example await sleep(200 * 2 ** attempt);
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
