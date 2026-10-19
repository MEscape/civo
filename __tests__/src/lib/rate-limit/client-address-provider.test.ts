import { describe, expect, it, vi } from 'vitest';

import { createClientAddressProvider } from '@lib/rate-limit/client-address-provider';
import type { ClientAddressProviderDeps } from '@lib/rate-limit/client-address-provider';

import { createFakeLog, createManualClock } from './support';

function providerFor(
  source: 'vercel' | 'none',
  values: Record<string, string> | 'no-request',
  overrides: Partial<ClientAddressProviderDeps> = {},
  configured = true,
) {
  const log = createFakeLog();
  const clock = createManualClock();
  const provider = createClientAddressProvider({
    getHeaders:
      values === 'no-request'
        ? () => Promise.reject(new Error('headers() was called outside a request scope'))
        : () => Promise.resolve({ get: (name: string) => values[name.toLowerCase()] ?? null }),
    settings: { source, configured, trustedProxies: [] },
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

  it('logs the deliberate "none" source as info, not as a misconfiguration', async () => {
    const { provider, log } = providerFor('none', { 'x-forwarded-for': '203.0.113.7' });

    expect(await provider.current()).toEqual({ kind: 'unresolved-client' });
    expect(log.info).toHaveBeenCalledWith('rate_limit.client_unresolved', {
      reason: 'source_disabled',
    });
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('warns, not just informs, when nothing was configured: an oversight must be visible', async () => {
    const { provider, log } = providerFor('none', { 'x-forwarded-for': '203.0.113.7' }, {}, false);

    expect(await provider.current()).toEqual({ kind: 'unresolved-client' });
    expect(log.warn).toHaveBeenCalledWith('rate_limit.client_unresolved', {
      reason: 'source_not_configured',
    });
    expect(log.info).not.toHaveBeenCalled();
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
