import { describe, expect, it } from 'vitest';

import { InMemoryRateLimitStore } from './in-memory-rate-limit-store';
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

  it('tracks earliest expiry across multiple surviving buckets and rejects when still full after sweep', async () => {
    const clock = createManualClock();
    const store = new InMemoryRateLimitStore(clock, 4);
    await store.hit('a', 5);
    await store.hit('b', 10);
    await store.hit('c', 20);
    await store.hit('d', 30);

    // a expires after 5s; b (10s), c (20s), d (30s) remain.
    // In dropFinished: b sets earliest=10; c has 20 > 10 (false branch); d has 30 > 10 (false branch).
    clock.advanceSeconds(5);
    expect((await store.hit('e', 25)).hits).toBe(1);

    // Now table is full with 4 live buckets: b, c, d, e.
    await expect(store.hit('f', 10)).rejects.toThrow(/full/);

    // Before earliestExpiryMs (10s total): nowMs < earliestExpiryMs, sweep skipped, immediately rejected
    clock.advanceSeconds(1);
    await expect(store.hit('f', 10)).rejects.toThrow(/full/);
  });
});
