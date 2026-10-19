import { describe, expect, it } from 'vitest';

import { InMemoryRateLimitStore } from '@lib/rate-limit/in-memory-rate-limit-store';

import { createManualClock } from './support';

describe('InMemoryRateLimitStore', () => {
  it('counts hits within a window and reports the seconds left, rounded up', async () => {
    const clock = createManualClock();
    const store = new InMemoryRateLimitStore(clock);

    expect(await store.hit('k', 60)).toEqual({ hits: 1, retryAfterSeconds: 60 });
    clock.advanceSeconds(0.5);
    expect(await store.hit('k', 60)).toEqual({ hits: 2, retryAfterSeconds: 60 });
    clock.advanceSeconds(10);
    expect(await store.hit('k', 60)).toEqual({ hits: 3, retryAfterSeconds: 50 });
  });

  it('restarts the counter exactly when the window ends', async () => {
    const clock = createManualClock();
    const store = new InMemoryRateLimitStore(clock);
    await store.hit('k', 60);
    await store.hit('k', 60);

    clock.advanceSeconds(59.999);
    expect((await store.hit('k', 60)).hits).toBe(3);
    clock.advanceSeconds(0.001);
    expect((await store.hit('k', 60)).hits).toBe(1);
  });

  it('is bounded: finished windows are dropped first, live counters are never evicted', async () => {
    const clock = createManualClock();
    const store = new InMemoryRateLimitStore(clock, 2);
    await store.hit('a', 10);
    await store.hit('b', 100);

    await expect(store.hit('c', 10)).rejects.toThrow(/full/);
    expect((await store.hit('b', 100)).hits).toBe(2);

    clock.advanceSeconds(10);
    expect((await store.hit('c', 10)).hits).toBe(1);
    expect((await store.hit('b', 100)).hits).toBe(3);
  });
});
