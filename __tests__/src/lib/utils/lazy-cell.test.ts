import { describe, expect, it, vi } from 'vitest';

import { BUILD_RETRY_INTERVAL_MS, createLazyCell, resolveLazy } from '@lib/utils';

describe('resolveLazy', () => {
  const fixedClock = { now: () => new Date('2026-10-21T00:00:00.000Z') };

  it('builds the value once and caches it on subsequent calls', () => {
    const cell = createLazyCell<string>();
    const build = vi.fn().mockReturnValue('built-val');

    const first = resolveLazy({ cell, build, clock: fixedClock });
    expect(first).toEqual({ isReady: true, value: 'built-val' });
    expect(build).toHaveBeenCalledTimes(1);

    const second = resolveLazy({ cell, build, clock: fixedClock });
    expect(second).toEqual({ isReady: true, value: 'built-val' });
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('remembers failure and does not call build again within the retry interval', () => {
    const cell = createLazyCell<string>();
    const build = vi.fn().mockImplementation(() => {
      throw new Error('config missing');
    });
    const onFailure = vi.fn();

    const first = resolveLazy({ cell, build, clock: fixedClock, onFailure });
    expect(first.isReady).toBe(false);
    expect(build).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);

    // Call again within the cooldown window (3 seconds later)
    const midClock = { now: () => new Date('2026-10-21T00:00:03.000Z') };
    const second = resolveLazy({ cell, build, clock: midClock, onFailure });
    expect(second.isReady).toBe(false);
    expect(build).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1); // not called again
  });

  it('swallows failure when the logger itself throws in onFailure', () => {
    const cell = createLazyCell<string>();
    const build = vi.fn().mockImplementation(() => {
      throw new Error('config missing');
    });
    const brokenLogger = vi.fn().mockImplementation(() => {
      throw new Error('disk full in logger');
    });

    const result = resolveLazy({ cell, build, clock: fixedClock, onFailure: brokenLogger });
    expect(result.isReady).toBe(false);
  });

  it('retries build after the retry interval has elapsed and recovers if build succeeds', () => {
    const cell = createLazyCell<string>();
    let attempts = 0;
    const build = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts === 1) {
        throw new Error('initial failure');
      }
      return 'recovered-val';
    });

    resolveLazy({ cell, build, clock: fixedClock });
    expect(attempts).toBe(1);

    // Advance clock past the retry interval
    const afterCooldown = {
      now: () => new Date(fixedClock.now().getTime() + BUILD_RETRY_INTERVAL_MS + 100),
    };
    const recovered = resolveLazy({ cell, build, clock: afterCooldown });
    expect(recovered).toEqual({ isReady: true, value: 'recovered-val' });
    expect(attempts).toBe(2);
  });
});
