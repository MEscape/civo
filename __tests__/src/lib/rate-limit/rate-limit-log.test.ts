import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogThrottle } from '@lib/rate-limit/rate-limit-log';
import { createRateLimitLog } from '@lib/rate-limit/rate-limit-logger';

import { createManualClock } from './support';

const { base } = vi.hoisted(() => ({
  base: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('server-only', () => ({}));
vi.mock('@lib/logger', () => ({ logger: { withContext: vi.fn(() => base) } }));

describe('createLogThrottle', () => {
  it('writes the first event and drops the rest of the interval, counting them', () => {
    const clock = createManualClock();
    const throttle = createLogThrottle(clock, 10_000);

    expect(throttle.admit('a')).toEqual({ write: true, suppressed: 0 });
    expect(throttle.admit('a')).toEqual({ write: false, suppressed: 0 });
    expect(throttle.admit('a')).toEqual({ write: false, suppressed: 0 });

    clock.advanceSeconds(10);

    expect(throttle.admit('a')).toEqual({ write: true, suppressed: 2 });
    expect(throttle.admit('a')).toEqual({ write: false, suppressed: 0 });
  });

  it('keeps events with different keys apart', () => {
    const throttle = createLogThrottle(createManualClock(), 10_000);

    expect(throttle.admit('a').write).toBe(true);
    expect(throttle.admit('b').write).toBe(true);
    expect(throttle.admit('a').write).toBe(false);
  });

  it('is bounded: an endless stream of distinct keys cannot grow it without limit', () => {
    const throttle = createLogThrottle(createManualClock(), 10_000);
    for (let key = 0; key < 600; key += 1) {
      throttle.admit(`key-${key}`);
    }

    // After the table was cleared, an old key is written again instead of being remembered.
    expect(throttle.admit('key-0').write).toBe(true);
  });
});

describe('createRateLimitLog', () => {
  beforeEach(() => {
    base.info.mockClear();
    base.warn.mockClear();
    base.error.mockClear();
  });

  it('writes under the rate-limit module with only the safe context it is given', () => {
    const log = createRateLimitLog();
    const failure = new Error('store down');

    log.info('rate_limit.rejected', { policy: 'a.b' });
    log.warn('rate_limit.failed_open', { policy: 'a.b', reason: 'timeout' });
    log.error('rate_limit.backend_failed', failure, { policy: 'a.b', suppressed: 3 });

    expect(base.info).toHaveBeenCalledWith('rate_limit.rejected', { policy: 'a.b' });
    expect(base.warn).toHaveBeenCalledWith('rate_limit.failed_open', {
      policy: 'a.b',
      reason: 'timeout',
    });
    expect(base.error).toHaveBeenCalledWith('rate_limit.backend_failed', failure, {
      policy: 'a.b',
      suppressed: 3,
    });
  });

  it('copes with a call that has no context', () => {
    const log = createRateLimitLog();

    log.info('rate_limit.rejected');
    log.warn('rate_limit.failed_open');
    log.error('rate_limit.backend_failed', new Error('x'));

    expect(base.info).toHaveBeenCalledWith('rate_limit.rejected', {});
    expect(base.warn).toHaveBeenCalledWith('rate_limit.failed_open', {});
    expect(base.error).toHaveBeenCalledWith('rate_limit.backend_failed', expect.any(Error), {});
  });
});
