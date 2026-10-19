import { describe, expect, it, vi } from 'vitest';

import { createRateLimiter } from '@lib/rate-limit/create-rate-limiter';
import { InMemoryRateLimitStore } from '@lib/rate-limit/in-memory-rate-limit-store';
import type { RateLimitPolicy } from '@lib/rate-limit/rate-limit-policy';
import type { RateLimitStore } from '@lib/rate-limit/rate-limit-store';
import type { RateLimitSubject } from '@lib/rate-limit/rate-limit-subject';

import { SECRET, createFakeLog, createManualClock } from './support';

const POLICY: RateLimitPolicy = {
  id: 'test.operation',
  limit: 3,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};
const PERSON: RateLimitSubject = { kind: 'identifier', value: 'person@example.org' };

function setup(options: { store?: RateLimitStore; timeoutMs?: number } = {}) {
  const clock = createManualClock();
  const log = createFakeLog();
  const store = options.store ?? new InMemoryRateLimitStore(clock);
  const limiter = createRateLimiter({
    store,
    keySecret: SECRET,
    clock,
    timeoutMs: options.timeoutMs ?? 50,
    log,
  });
  return { clock, log, store, limiter };
}

const failingStore: RateLimitStore = {
  hit: () => Promise.reject(new Error('connection refused to db.internal:5432')),
};

describe('createRateLimiter: counting', () => {
  it('allows attempts up to the limit and reports what is left', async () => {
    const { limiter } = setup();

    const remaining: Array<number | null> = [];
    for (let attempt = 0; attempt < POLICY.limit; attempt += 1) {
      const result = await limiter.enforce({ policy: POLICY, subject: PERSON });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toMatchObject({ limit: 3, degraded: false });
        remaining.push(result.value.remaining);
      }
    }
    expect(remaining).toEqual([2, 1, 0]);
  });

  it('rejects the attempt after the limit with a rate_limited error and the time left', async () => {
    const { limiter, clock } = setup();
    for (let attempt = 0; attempt < POLICY.limit; attempt += 1) {
      await limiter.enforce({ policy: POLICY, subject: PERSON });
    }

    const rejected = await limiter.enforce({ policy: POLICY, subject: PERSON });
    expect(rejected.isErr() && rejected.error).toMatchObject({
      kind: 'rate_limited',
      code: 'rate_limit.exceeded',
      retryAfterSeconds: 60,
    });

    clock.advanceSeconds(20);
    const later = await limiter.enforce({ policy: POLICY, subject: PERSON });
    expect(later.isErr() && later.error).toMatchObject({ retryAfterSeconds: 40 });
  });

  it('allows again once the window has run out', async () => {
    const { limiter, clock } = setup();
    for (let attempt = 0; attempt < POLICY.limit + 2; attempt += 1) {
      await limiter.enforce({ policy: POLICY, subject: PERSON });
    }

    clock.advanceSeconds(60);
    const result = await limiter.enforce({ policy: POLICY, subject: PERSON });
    expect(result.isOk() && result.value.remaining).toBe(2);
  });

  it('does not extend the window for a client that keeps hammering', async () => {
    const { limiter, clock } = setup();
    for (let attempt = 0; attempt < POLICY.limit; attempt += 1) {
      await limiter.enforce({ policy: POLICY, subject: PERSON });
    }
    for (let second = 0; second < 59; second += 1) {
      clock.advanceSeconds(1);
      expect((await limiter.enforce({ policy: POLICY, subject: PERSON })).isErr()).toBe(true);
    }

    clock.advanceSeconds(1);
    expect((await limiter.enforce({ policy: POLICY, subject: PERSON })).isOk()).toBe(true);
  });

  it('cannot be bypassed by concurrent requests', async () => {
    const { limiter } = setup();

    const results = await Promise.all(
      Array.from({ length: 20 }, () => limiter.enforce({ policy: POLICY, subject: PERSON })),
    );

    expect(results.filter((result) => result.isOk())).toHaveLength(POLICY.limit);
    expect(results.filter((result) => result.isErr())).toHaveLength(20 - POLICY.limit);
  });
});

describe('createRateLimiter: independence', () => {
  async function exhaust(
    limiter: ReturnType<typeof setup>['limiter'],
    policy: RateLimitPolicy,
    subject: RateLimitSubject,
  ) {
    for (let attempt = 0; attempt < policy.limit; attempt += 1) {
      await limiter.enforce({ policy, subject });
    }
  }

  it('keeps policies apart for the same subject', async () => {
    const { limiter } = setup();
    await exhaust(limiter, POLICY, PERSON);

    const other = await limiter.enforce({
      policy: { ...POLICY, id: 'test.other' },
      subject: PERSON,
    });
    expect(other.isOk()).toBe(true);
  });

  it('keeps subjects apart, including different actors and tenants', async () => {
    const { limiter } = setup();
    const alice = { kind: 'actor', tenantId: 't1', actorId: 'alice' } as const;
    await exhaust(limiter, POLICY, alice);

    for (const subject of [
      { kind: 'actor', tenantId: 't1', actorId: 'bob' },
      { kind: 'actor', tenantId: 't2', actorId: 'alice' },
    ] as const) {
      expect((await limiter.enforce({ policy: POLICY, subject })).isOk()).toBe(true);
    }
    expect((await limiter.enforce({ policy: POLICY, subject: alice })).isErr()).toBe(true);
  });

  it('does not let an identifier and a client address with the same text share a budget', async () => {
    const { limiter } = setup();
    await exhaust(limiter, POLICY, { kind: 'identifier', value: '203.0.113.7' });

    const client = await limiter.enforce({
      policy: POLICY,
      subject: { kind: 'client', address: '203.0.113.7' },
    });
    expect(client.isOk()).toBe(true);
  });

  it('shares one budget for the global subject', async () => {
    const { limiter } = setup();
    const global = { kind: 'global' } as const;
    await exhaust(limiter, POLICY, global);

    expect((await limiter.enforce({ policy: POLICY, subject: global })).isErr()).toBe(true);
  });
});

describe('createRateLimiter: unresolved client', () => {
  const UNRESOLVED: RateLimitSubject = { kind: 'unresolved-client' };

  it('skips the limit by default: uncounted, marked degraded, logged, and the store is not touched', async () => {
    const hit = vi.fn();
    const { limiter, log } = setup({ store: { hit } });

    const result = await limiter.enforce({ policy: POLICY, subject: UNRESOLVED });

    expect(result.isOk() && result.value).toEqual({
      limit: 3,
      remaining: null,
      resetAfterSeconds: null,
      degraded: true,
    });
    expect(hit).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith('rate_limit.client_unresolved', {
      policy: 'test.operation',
      reason: 'skipped',
    });
  });

  it('denies, as an infrastructure error and not as rate limiting, when the policy says deny', async () => {
    const hit = vi.fn();
    const { limiter } = setup({ store: { hit } });

    const result = await limiter.enforce({
      policy: { ...POLICY, onUnresolvedClient: 'deny' },
      subject: UNRESOLVED,
    });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'rate_limit.client_unresolved',
    });
    expect(hit).not.toHaveBeenCalled();
  });

  it('does not let all unidentified clients share one budget', async () => {
    const { limiter } = setup();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await limiter.enforce({ policy: POLICY, subject: UNRESOLVED });
      expect(result.isOk()).toBe(true);
    }
  });

  it('is independent of the backend failure mode', async () => {
    const { limiter } = setup({ store: failingStore });

    const result = await limiter.enforce({
      policy: { ...POLICY, onUnresolvedClient: 'deny', onBackendFailure: 'allow' },
      subject: UNRESOLVED,
    });

    expect(result.isErr() && result.error.code).toBe('rate_limit.client_unresolved');
  });
});

describe('createRateLimiter: composite enforcement', () => {
  const PER_CLIENT: RateLimitPolicy = {
    id: 'test.per-client',
    limit: 2,
    windowSeconds: 60,
    onBackendFailure: 'deny',
  };
  const PER_ACCOUNT: RateLimitPolicy = {
    id: 'test.per-account',
    limit: 5,
    windowSeconds: 60,
    onBackendFailure: 'deny',
  };
  const CLIENT: RateLimitSubject = { kind: 'client', address: '203.0.113.7' };
  const ACCOUNT: RateLimitSubject = { kind: 'identifier', value: 'victim@example.org' };
  const both = [
    { policy: PER_CLIENT, subject: CLIENT },
    { policy: PER_ACCOUNT, subject: ACCOUNT },
  ] as const;

  it('allows while every policy has budget, returning the allowances in order', async () => {
    const { limiter } = setup();

    const result = await limiter.enforceAll(both);

    expect(result.isOk() && result.value.map((allowance) => allowance.limit)).toEqual([2, 5]);
    expect(result.isOk() && result.value.map((allowance) => allowance.remaining)).toEqual([1, 4]);
  });

  it('refuses with the first rejecting policy and does not count the policies after it', async () => {
    const { limiter } = setup();
    await limiter.enforceAll(both);
    await limiter.enforceAll(both);

    const third = await limiter.enforceAll(both);
    expect(third.isErr() && third.error).toMatchObject({ kind: 'rate_limited' });

    // The account was counted twice, not three times: the refusal at the client policy stopped it.
    const other = await limiter.enforce({
      policy: PER_ACCOUNT,
      subject: ACCOUNT,
    });
    expect(other.isOk() && other.value.remaining).toBe(2);
  });

  it("keeps one address from burning more of a victim's budget than its own allows", async () => {
    const { limiter } = setup();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await limiter.enforceAll(both);
    }

    const otherClient = await limiter.enforceAll([
      { policy: PER_CLIENT, subject: { kind: 'client', address: '198.51.100.9' } },
      { policy: PER_ACCOUNT, subject: ACCOUNT },
    ]);

    expect(otherClient.isOk() && otherClient.value[1]?.remaining).toBe(2);
  });

  it('does not refund a budget already counted when a later policy refuses', async () => {
    const { limiter } = setup();
    const tight = { ...PER_ACCOUNT, limit: 1 };
    await limiter.enforce({ policy: tight, subject: ACCOUNT });

    const refused = await limiter.enforceAll([
      { policy: PER_CLIENT, subject: CLIENT },
      { policy: tight, subject: ACCOUNT },
    ]);

    expect(refused.isErr() && refused.error.kind).toBe('rate_limited');
    const client = await limiter.enforce({ policy: PER_CLIENT, subject: CLIENT });
    expect(client.isOk() && client.value.remaining).toBe(0);
  });

  it('reports a store failure as a failure, with each policy applying its own failure mode', async () => {
    const { limiter } = setup({ store: failingStore });

    const denied = await limiter.enforceAll(both);
    const degraded = await limiter.enforceAll([
      { policy: { ...PER_CLIENT, onBackendFailure: 'allow' }, subject: CLIENT },
      { policy: { ...PER_ACCOUNT, onBackendFailure: 'allow' }, subject: ACCOUNT },
    ]);

    expect(denied.isErr() && denied.error.kind).toBe('infrastructure');
    expect(degraded.isOk() && degraded.value.every((allowance) => allowance.degraded)).toBe(true);
  });

  it('skips an unresolved client without weakening the account policy', async () => {
    const { limiter } = setup();

    const results = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      results.push(
        await limiter.enforceAll([
          { policy: PER_CLIENT, subject: { kind: 'unresolved-client' } },
          { policy: PER_ACCOUNT, subject: ACCOUNT },
        ]),
      );
    }

    expect(results.filter((result) => result.isOk())).toHaveLength(5);
    expect(results[5]?.isErr() && results[5].error.kind).toBe('rate_limited');
  });

  it('refuses an empty list and a policy used twice, without touching the store', async () => {
    const hit = vi.fn();
    const { limiter } = setup({ store: { hit } });

    const empty = await limiter.enforceAll([]);
    const twice = await limiter.enforceAll([
      { policy: PER_CLIENT, subject: CLIENT },
      { policy: PER_CLIENT, subject: { kind: 'client', address: '198.51.100.9' } },
    ]);

    for (const result of [empty, twice]) {
      expect(result.isErr() && result.error.code).toBe('rate_limit.invalid_request');
    }
    expect(hit).not.toHaveBeenCalled();
  });

  it('never rejects, even for hostile input', async () => {
    const { limiter } = setup();

    const result = await limiter.enforceAll(null as unknown as []);

    expect(result.isErr() && result.error.code).toBe('rate_limit.unexpected_failure');
  });
});

describe('createRateLimiter: backend failure', () => {
  it('denies with an infrastructure error (not a rate-limit rejection) when the policy says deny', async () => {
    const { limiter, log } = setup({ store: failingStore });

    const result = await limiter.enforce({ policy: POLICY, subject: PERSON });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'rate_limit.backend_unavailable',
    });
    expect(log.error).toHaveBeenCalledWith('rate_limit.backend_failed', expect.any(Error), {
      policy: 'test.operation',
      reason: 'store_error',
    });
  });

  it('never exposes backend detail to the caller', async () => {
    const { limiter } = setup({ store: failingStore });

    const result = await limiter.enforce({ policy: POLICY, subject: PERSON });

    expect(result.isErr() && result.error.message).toBe('Rate limiting is unavailable.');
  });

  it('lets the attempt through, marked degraded and logged, when the policy says allow', async () => {
    const { limiter, log } = setup({ store: failingStore });

    const result = await limiter.enforce({
      policy: { ...POLICY, onBackendFailure: 'allow' },
      subject: PERSON,
    });

    expect(result.isOk() && result.value).toEqual({
      limit: 3,
      remaining: null,
      resetAfterSeconds: null,
      degraded: true,
    });
    expect(log.warn).toHaveBeenCalledWith('rate_limit.failed_open', {
      policy: 'test.operation',
      reason: 'store_error',
    });
  });

  it('keeps denying while the store is down: it never falls back to counting locally', async () => {
    const { limiter } = setup({ store: failingStore });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await limiter.enforce({ policy: POLICY, subject: PERSON });
      expect(result.isErr() && result.error.kind).toBe('infrastructure');
    }
  });

  it('treats a store that does not answer in time as a failure', async () => {
    const hung: RateLimitStore = {
      hit: () => new Promise(() => undefined),
    };
    const { limiter, log } = setup({ store: hung, timeoutMs: 20 });

    const result = await limiter.enforce({ policy: POLICY, subject: PERSON });

    expect(result.isErr() && result.error.kind).toBe('infrastructure');
    expect(log.error).toHaveBeenCalledWith('rate_limit.backend_failed', expect.any(Error), {
      policy: 'test.operation',
      reason: 'timeout',
    });
  });

  it.each([
    ['nothing at all', undefined],
    ['null', null],
    ['zero hits', { hits: 0, retryAfterSeconds: 5 }],
    ['hits as text', { hits: '2', retryAfterSeconds: 5 }],
    ['fractional hits', { hits: 1.5, retryAfterSeconds: 5 }],
    ['a non-finite delay', { hits: 1, retryAfterSeconds: Number.NaN }],
  ])('treats a malformed store answer (%s) as a backend failure', async (_name, answer) => {
    const store: RateLimitStore = {
      hit: () => Promise.resolve(answer as never),
    };
    const { limiter } = setup({ store });

    const result = await limiter.enforce({ policy: POLICY, subject: PERSON });

    expect(result.isErr() && result.error.kind).toBe('infrastructure');
  });
});

describe('createRateLimiter: invalid input always denies', () => {
  it.each([
    ['a limit of zero', { ...POLICY, limit: 0 }],
    ['a malformed id', { ...POLICY, id: 'Not Valid' }],
    ['a missing failure mode', { id: 'test.operation', limit: 1, windowSeconds: 1 }],
    ['an unknown failure mode', { ...POLICY, onBackendFailure: 'open' }],
  ])(
    'refuses a policy with %s, even when the policy would otherwise allow',
    async (_name, broken) => {
      const hit = vi.fn();
      const { limiter } = setup({ store: { hit } });
      const policy = broken as unknown as RateLimitPolicy;

      const result = await limiter.enforce({ policy, subject: PERSON });

      expect(result.isErr() && result.error).toMatchObject({
        kind: 'infrastructure',
        code: 'rate_limit.invalid_request',
      });
      expect(hit).not.toHaveBeenCalled();
    },
  );

  it('refuses an empty or oversized subject without touching the store', async () => {
    const hit = vi.fn();
    const { limiter } = setup({ store: { hit } });
    const policy = { ...POLICY, onBackendFailure: 'allow' } as const;

    for (const subject of [
      { kind: 'identifier', value: '' },
      { kind: 'client', address: 'x'.repeat(1000) },
    ] as const) {
      const result = await limiter.enforce({ policy, subject });
      expect(result.isErr() && result.error.code).toBe('rate_limit.invalid_request');
    }
    expect(hit).not.toHaveBeenCalled();
  });
});

describe('createRateLimiter: it never throws', () => {
  it('turns an unforeseen error into a denial instead of a rejected promise', async () => {
    const { limiter, log } = setup();
    const hostile = {
      kind: 'identifier',
      get value(): string {
        throw new Error('boom');
      },
    } as unknown as RateLimitSubject;
    const policy = { ...POLICY, onBackendFailure: 'allow' } as const;

    const result = await limiter.enforce({ policy, subject: hostile });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'rate_limit.unexpected_failure',
    });
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});

describe('createRateLimiter: logging', () => {
  it('writes one line per policy per interval during a flood, with a count of the rest', async () => {
    const { limiter, log, clock } = setup();
    for (let attempt = 0; attempt < POLICY.limit; attempt += 1) {
      await limiter.enforce({ policy: POLICY, subject: PERSON });
    }

    for (let rejected = 0; rejected < 100; rejected += 1) {
      await limiter.enforce({ policy: POLICY, subject: PERSON });
    }
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenLastCalledWith('rate_limit.rejected', { policy: 'test.operation' });

    clock.advanceSeconds(10);
    await limiter.enforce({ policy: POLICY, subject: PERSON });
    expect(log.info).toHaveBeenCalledTimes(2);
    expect(log.info).toHaveBeenLastCalledWith('rate_limit.rejected', {
      policy: 'test.operation',
      suppressed: 99,
    });
  });

  it('logs a store outage once per interval, not once per request', async () => {
    const { limiter, log } = setup({ store: failingStore });

    for (let attempt = 0; attempt < 50; attempt += 1) {
      await limiter.enforce({ policy: POLICY, subject: PERSON });
    }

    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it('never logs a subject, a key or backend connection detail in a context', async () => {
    const { limiter, log } = setup();
    for (let attempt = 0; attempt < POLICY.limit + 1; attempt += 1) {
      await limiter.enforce({ policy: POLICY, subject: PERSON });
    }
    const failing = setup({ store: failingStore });
    await failing.limiter.enforce({ policy: POLICY, subject: PERSON });

    const contexts = JSON.stringify([
      ...log.info.mock.calls,
      ...failing.log.error.mock.calls.map(([message, , context]) => [message, context]),
    ]);
    expect(contexts).not.toContain('person@example.org');
    expect(contexts).not.toMatch(/[0-9a-f]{64}/);
    expect(contexts).not.toContain('db.internal');
  });
});
