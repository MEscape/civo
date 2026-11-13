import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RateLimitPolicy } from '@lib/rate-limit/rate-limit-policy';

const { resolveRateLimitSettings, logInfo, logError } = vi.hoisted(() => ({
  resolveRateLimitSettings: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@lib/config/server', () => ({ resolveRateLimitSettings, serverEnv: {} }));
vi.mock('@lib/logger', () => ({
  logger: { withContext: vi.fn(() => ({ info: logInfo, warn: vi.fn(), error: logError })) },
}));

const POLICY: RateLimitPolicy = {
  id: 'wiring.test',
  limit: 2,
  windowSeconds: 60,
  onBackendFailure: 'deny',
};
const SUBJECT = { kind: 'identifier', value: 'person@example.org' } as const;
const CLIENT_ADDRESS = { source: 'vercel', trustedProxies: [] } as const;

async function freshModule() {
  vi.resetModules();
  Reflect.deleteProperty(globalThis, 'rateLimiter');
  return import('@lib/rate-limit/default-rate-limiter');
}

const ENABLED = {
  enabled: true,
  restUrl: 'https://eu1-example.upstash.io/',
  restToken: 'token',
  keySecret: 's'.repeat(32),
  timeoutMs: 100,
  clientAddress: CLIENT_ADDRESS,
} as const;

beforeEach(() => {
  resolveRateLimitSettings.mockReset();
  logInfo.mockReset();
  logError.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getRateLimiter', () => {
  it('allows every attempt, reaches no store and says so once when rate limiting is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    resolveRateLimitSettings.mockReturnValue({ enabled: false });
    const { getRateLimiter } = await freshModule();

    const results = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      results.push(await getRateLimiter().enforce({ policy: POLICY, subject: SUBJECT }));
    }

    expect(results.map((result) => result.isOk())).toEqual([true, true, true]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resolveRateLimitSettings).toHaveBeenCalledTimes(1);
    expect(logInfo).toHaveBeenCalledTimes(1);
    expect(logInfo).toHaveBeenCalledWith('rate_limit.disabled', {
      reason: 'RATE_LIMIT_ENABLED=false',
    });
  });

  it('keys the hashes with the configured secret and counts in Upstash when told to', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ result: [1, 60_000] }), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    resolveRateLimitSettings.mockReturnValue(ENABLED);
    const { getRateLimiter } = await freshModule();

    const result = await getRateLimiter().enforce({ policy: POLICY, subject: SUBJECT });

    expect(result.isOk()).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://eu1-example.upstash.io');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token' });
    expect(init.body).toEqual(expect.not.stringContaining('person@example.org'));
  });

  it('refuses to build upstash limiter if keySecret is empty string', async () => {
    resolveRateLimitSettings.mockReturnValue({ ...ENABLED, keySecret: '' });
    const { getRateLimiter } = await freshModule();

    const result = await getRateLimiter().enforce({ policy: POLICY, subject: SUBJECT });
    expect(result.isErr()).toBe(true);
    expect(logError).toHaveBeenCalledWith(
      'rate_limit.unavailable',
      expect.objectContaining({
        message: 'A shared rate-limit store needs a configured key secret.',
      }),
      { reason: 'build_failed' },
    );
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
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ result: [1, 60_000] }), { status: 200 })),
      ),
    );
    resolveRateLimitSettings.mockReturnValue(ENABLED);
    const { getRateLimiter } = await freshModule();

    await getRateLimiter().enforce({ policy: POLICY, subject: SUBJECT });
    await getRateLimiter().enforce({ policy: POLICY, subject: SUBJECT });

    expect(resolveRateLimitSettings).toHaveBeenCalledTimes(1);
  });
});

describe('getClientAddressProvider', () => {
  it('reads the address from the headers the composition root hands it', async () => {
    resolveRateLimitSettings.mockReturnValue({
      ...ENABLED,
      clientAddress: { source: 'proxies', trustedProxies: ['10.0.0.1'] },
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
    resolveRateLimitSettings.mockReturnValue(ENABLED);
    vi.resetModules();
    const { getClientAddressProvider } =
      await import('@lib/rate-limit/default-client-address-provider');

    const provider = getClientAddressProvider(() => Promise.reject(new Error('outside a request')));

    await expect(provider.current()).resolves.toEqual({ kind: 'unresolved-client' });
  });

  it('resolves no address while rate limiting is disabled, without logging a misconfiguration', async () => {
    resolveRateLimitSettings.mockReturnValue({ enabled: false });
    vi.resetModules();
    const { getClientAddressProvider } =
      await import('@lib/rate-limit/default-client-address-provider');

    const withRequest = getClientAddressProvider(() =>
      Promise.resolve({ get: () => '203.0.113.1' }),
    );
    const withoutRequest = getClientAddressProvider(() =>
      Promise.reject(new Error('outside a request')),
    );

    await expect(withRequest.current()).resolves.toEqual({ kind: 'unresolved-client' });
    await expect(withoutRequest.current()).resolves.toEqual({ kind: 'unresolved-client' });
    expect(logError).not.toHaveBeenCalled();
  });

  it('handles misconfigured client address settings by falling back to unresolved-client and logging error', async () => {
    resolveRateLimitSettings.mockImplementation(() => {
      throw new Error('invalid client address settings');
    });
    vi.resetModules();
    const { getClientAddressProvider } =
      await import('@lib/rate-limit/default-client-address-provider');

    const providerWithReq = getClientAddressProvider(() =>
      Promise.resolve({ get: () => '203.0.113.1' }),
    );
    await expect(providerWithReq.current()).resolves.toEqual({ kind: 'unresolved-client' });

    const providerWithoutReq = getClientAddressProvider(() =>
      Promise.reject(new Error('outside a request')),
    );
    await expect(providerWithoutReq.current()).resolves.toEqual({ kind: 'unresolved-client' });

    expect(logError).toHaveBeenCalledWith('rate_limit.client_unresolved', expect.any(Error), {
      reason: 'misconfigured',
    });
  });
});
