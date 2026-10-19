import { vi } from 'vitest';

import type { Clock } from '@lib/clock';
import type { RateLimitLog } from '@lib/rate-limit/rate-limit-log';

/** A clock the test moves by hand. */
export interface ManualClock extends Clock {
  advanceSeconds(seconds: number): void;
}

export function createManualClock(startMs = Date.UTC(2026, 0, 1)): ManualClock {
  let nowMs = startMs;
  return {
    now: () => new Date(nowMs),
    advanceSeconds: (seconds) => {
      nowMs += seconds * 1000;
    },
  };
}

export interface FakeLog extends RateLimitLog {
  readonly info: ReturnType<typeof vi.fn<RateLimitLog['info']>>;
  readonly warn: ReturnType<typeof vi.fn<RateLimitLog['warn']>>;
  readonly error: ReturnType<typeof vi.fn<RateLimitLog['error']>>;
}

export function createFakeLog(): FakeLog {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

export const SECRET = 'k'.repeat(32);
