import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RateLimitPolicy } from '@lib/rate-limit/rate-limit-policy';

const { resolveRateLimitSettings, logError } = vi.hoisted(() => ({
  resolveRateLimitSettings: vi.fn(),
  logError: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@lib/config/server', () => ({ resolveRateLimitSettings, serverEnv: {} }));
vi.mock('@lib/logger', () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: logError })) },
}));

const POLICY: RateLimitPolicy = {
  id: 'wiring.test',
  limit: 2,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};
const SUBJECT = { kind: 'identifier', value: 'person@example.org' } as const;
const CLIENT_ADDRESS = { source: 'none', configured: false, trustedProxies: [] } as const;

async function freshModule() {
  vi.resetModules();
  Reflect.deleteProperty(globalThis, 'rateLimiter');
  return import('@lib/rate-limit/default-rate-limiter');
}

beforeEach(() => {
  resolveRateLimitSettings.mockReset();
  logError.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getRateLimiter', () => {
  it('counts in process memory when the settings name the memory backend', async () => {
    resolveRateLimitSettings.mockReturnValue({
      backend: 'memory',
      keySecret: undefined,
      timeoutMs: 100,
      clientAddress: CLIENT_ADDRESS,
    });
    const { getRateLimiter } = await freshModule();

    const results = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      results.push(await getRateLimiter().enforce({ policy: POLICY, subject: SUBJECT }));
    }

    expect(results.map((result) => result.isOk())).toEqual([true, true, false]);
    expect(resolveRateLimitSettings).toHaveBeenCalledTimes(1);
  });

  it('keys the hashes with the configured secret and counts in Upstash when told to', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ result: [1, 60_000] }), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    resolveRateLimitSettings.mockReturnValue({
      backend: 'upstash',
      restUrl: 'https://eu1-example.upstash.io/',
      restToken: 'token',
      keySecret: 's'.repeat(32),
      timeoutMs: 100,
      clientAddress: CLIENT_ADDRESS,
    });
    const { getRateLimiter } = await freshModule();

    const result = await getRateLimiter().enforce({ policy: POLICY, subject: SUBJECT });

    expect(result.isOk()).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://eu1-example.upstash.io');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token' });
    expect(init.body).toEqual(expect.not.stringContaining('person@example.org'));
  });

  it('refuses the attempt instead of throwing when the limiter cannot be built', async () => {
    resolveRateLimitSettings.mockImplementation(() => {
      throw new Error('Invalid rate-limit configuration');
    });
    const { getRateLimiter } = await freshModule();

    const single = await getRateLimiter().enforce({ policy: POLICY, subject: SUBJECT });
    const composite = await getRateLimiter().enforceAll([{ policy: POLICY, subject: SUBJECT }]);

    for (const result of [single, composite]) {
      expect(result.isErr() && result.error).toMatchObject({
        kind: 'infrastructure',
        code: 'rate_limit.unavailable',
      });
    }
    expect(logError).toHaveBeenCalledWith('rate_limit.unavailable', expect.any(Error), {
      reason: 'build_failed',
    });
  });

  it('builds its limiter once and shares it', async () => {
    resolveRateLimitSettings.mockReturnValue({
      backend: 'memory',
      keySecret: 'k'.repeat(32),
      timeoutMs: 100,
      clientAddress: CLIENT_ADDRESS,
    });
    const { getRateLimiter } = await freshModule();

    await getRateLimiter().enforce({ policy: POLICY, subject: SUBJECT });
    await getRateLimiter().enforce({ policy: POLICY, subject: SUBJECT });

    expect(resolveRateLimitSettings).toHaveBeenCalledTimes(1);
  });
});

describe('getClientAddressProvider', () => {
  it('reads the address from the headers the composition root hands it', async () => {
    resolveRateLimitSettings.mockReturnValue({
      backend: 'memory',
      keySecret: undefined,
      timeoutMs: 100,
      clientAddress: { source: 'proxies', configured: true, trustedProxies: ['10.0.0.1'] },
    });
    vi.resetModules();
    const { getClientAddressProvider } =
      await import('@lib/rate-limit/default-client-address-provider');

    const provider = getClientAddressProvider(() =>
      Promise.resolve({
        get: (name: string) => (name === 'x-forwarded-for' ? '203.0.113.9, 10.0.0.1' : null),
      }),
    );

    await expect(provider.current()).resolves.toEqual({ kind: 'client', address: '203.0.113.9' });
  });

  it('cannot tell who is calling outside a request, and says so instead of guessing', async () => {
    resolveRateLimitSettings.mockReturnValue({
      backend: 'memory',
      keySecret: undefined,
      timeoutMs: 100,
      clientAddress: CLIENT_ADDRESS,
    });
    vi.resetModules();
    const { getClientAddressProvider } =
      await import('@lib/rate-limit/default-client-address-provider');

    const provider = getClientAddressProvider(() => Promise.reject(new Error('outside a request')));

    await expect(provider.current()).resolves.toEqual({ kind: 'unresolved-client' });
  });
});
