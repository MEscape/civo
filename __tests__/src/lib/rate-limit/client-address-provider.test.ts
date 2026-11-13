import { describe, expect, it, vi } from 'vitest';

import { createClientAddressProvider } from '@lib/rate-limit/client-address-provider';
import type { ClientAddressProviderDeps } from '@lib/rate-limit/client-address-provider';

import { createFakeLog, createManualClock } from './support';

function providerFor(
  source: 'vercel' | 'cloudflare',
  values: Record<string, string> | 'no-request',
  overrides: Partial<ClientAddressProviderDeps> = {},
) {
  const log = createFakeLog();
  const clock = createManualClock();
  const provider = createClientAddressProvider({
    getHeaders:
      values === 'no-request'
        ? () => Promise.reject(new Error('headers() was called outside a request scope'))
        : () => Promise.resolve({ get: (name: string) => values[name.toLowerCase()] ?? null }),
    settings: { source, trustedProxies: [] },
    clock,
    log,
    ...overrides,
  });
  return { provider, log, clock };
}

describe('client address provider', () => {
  it('returns the resolved address as a client subject', async () => {
    const { provider, log } = providerFor('vercel', { 'x-vercel-forwarded-for': '203.0.113.7' });

    expect(await provider.current()).toEqual({ kind: 'client', address: '203.0.113.7' });
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('returns unresolved-client, never a guess, when the header is missing, and warns', async () => {
    const { provider, log } = providerFor('vercel', {});

    expect(await provider.current()).toEqual({ kind: 'unresolved-client' });
    expect(log.warn).toHaveBeenCalledWith('rate_limit.client_unresolved', {
      reason: 'header_missing',
    });
  });

  it('returns unresolved-client outside a request instead of rejecting', async () => {
    const { provider, log } = providerFor('vercel', 'no-request');

    expect(await provider.current()).toEqual({ kind: 'unresolved-client' });
    expect(log.warn).toHaveBeenCalledWith('rate_limit.client_unresolved', { reason: 'no_request' });
  });

  it('reads the header of the platform it is configured for, and no other', async () => {
    const { provider } = providerFor('cloudflare', {
      'cf-connecting-ip': '203.0.113.7',
      'x-vercel-forwarded-for': '198.51.100.9',
    });

    expect(await provider.current()).toEqual({ kind: 'client', address: '203.0.113.7' });
  });

  it('logs once per interval and reason during a flood, with the count of the rest', async () => {
    const { provider, log, clock } = providerFor('vercel', {});

    for (let call = 0; call < 50; call += 1) {
      await provider.current();
    }
    expect(log.warn).toHaveBeenCalledTimes(1);

    clock.advanceSeconds(10);
    await provider.current();
    expect(log.warn).toHaveBeenLastCalledWith('rate_limit.client_unresolved', {
      reason: 'header_missing',
      suppressed: 49,
    });
  });

  it('never logs the header value or an address', async () => {
    const { provider, log } = providerFor('vercel', {
      'x-vercel-forwarded-for': 'secret-looking, 203.0.113.7',
    });

    await provider.current();

    const logged = JSON.stringify([log.info.mock.calls, log.warn.mock.calls, log.error.mock.calls]);
    expect(logged).not.toContain('203.0.113.7');
    expect(logged).not.toContain('secret-looking');
  });

  it('reads the headers of the current request on every call', async () => {
    const getHeaders = vi
      .fn<ClientAddressProviderDeps['getHeaders']>()
      .mockResolvedValueOnce({ get: () => '203.0.113.7' })
      .mockResolvedValueOnce({ get: () => '198.51.100.9' });
    const { provider } = providerFor('vercel', {}, { getHeaders });

    expect(await provider.current()).toEqual({ kind: 'client', address: '203.0.113.7' });
    expect(await provider.current()).toEqual({ kind: 'client', address: '198.51.100.9' });
  });
});

describe('createClientSubjectResolver', () => {
  it('resolves directly from headers and provides withoutRequest', async () => {
    const { createClientSubjectResolver } = await import('@lib/rate-limit/client-address-provider');
    const clock = createManualClock();
    const log = createFakeLog();
    const resolver = createClientSubjectResolver({
      settings: { source: 'vercel', trustedProxies: [] },
      clock,
      log,
    });

    const resolved = resolver.fromHeaders({
      get: (name) => (name.toLowerCase() === 'x-vercel-forwarded-for' ? '203.0.113.15' : null),
    });
    expect(resolved).toEqual({ kind: 'client', address: '203.0.113.15' });

    const unresolvedFromHeaders = resolver.fromHeaders({
      get: () => null,
    });
    expect(unresolvedFromHeaders).toEqual({ kind: 'unresolved-client' });

    const withoutReq = resolver.withoutRequest();
    expect(withoutReq).toEqual({ kind: 'unresolved-client' });
  });
});
