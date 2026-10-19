import { describe, expect, it } from 'vitest';

import { createClientAddressResolver } from '@lib/rate-limit/client-address';
import type { HeaderReader } from '@lib/rate-limit/client-address';

function headers(values: Record<string, string>): HeaderReader {
  return { get: (name) => values[name.toLowerCase()] ?? null };
}

const vercel = createClientAddressResolver({
  source: 'vercel',
  configured: true,
  trustedProxies: [],
});
const none = createClientAddressResolver({ source: 'none', configured: true, trustedProxies: [] });

function behind(...trustedProxies: string[]) {
  return createClientAddressResolver({ source: 'proxies', configured: true, trustedProxies });
}

const resolved = (address: string) => ({ status: 'resolved', address });
const unresolved = (reason: string) => ({ status: 'unresolved', reason });

describe('client address: source "none"', () => {
  it('resolves nothing, whatever the request claims', () => {
    expect(
      none(headers({ 'x-forwarded-for': '203.0.113.7', 'x-vercel-forwarded-for': '203.0.113.7' })),
    ).toEqual(unresolved('source_disabled'));
  });
});

describe('client address: source "none" that nobody configured', () => {
  it('says so, so the logs can tell an oversight from a decision', () => {
    const implicit = createClientAddressResolver({
      source: 'none',
      configured: false,
      trustedProxies: [],
    });

    expect(implicit(headers({ 'x-vercel-forwarded-for': '203.0.113.7' }))).toEqual(
      unresolved('source_not_configured'),
    );
  });
});

describe('client address: source "vercel"', () => {
  it('uses the platform header', () => {
    expect(vercel(headers({ 'x-vercel-forwarded-for': '203.0.113.7' }))).toEqual(
      resolved('203.0.113.7'),
    );
  });

  it('ignores x-forwarded-for and x-real-ip, which a client can send', () => {
    expect(
      vercel(headers({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '203.0.113.7' })),
    ).toEqual(unresolved('header_missing'));
  });

  it('is not fooled by a spoofed x-forwarded-for next to the platform header', () => {
    expect(
      vercel(headers({ 'x-vercel-forwarded-for': '198.51.100.9', 'x-forwarded-for': '1.1.1.1' })),
    ).toEqual(resolved('198.51.100.9'));
  });

  it.each([
    ['an empty header', '', 'header_missing'],
    ['blank hops', ' , ', 'header_missing'],
    ['several addresses', '203.0.113.7, 198.51.100.9', 'ambiguous_header'],
    ['text', 'unknown', 'header_malformed'],
    ['an address with a port', '203.0.113.7:4711', 'header_malformed'],
    ['an out-of-range octet', '256.1.1.1', 'header_malformed'],
    ['a script', '<script>alert(1)</script>', 'header_malformed'],
  ])('does not guess from %s', (_name, value, reason) => {
    expect(vercel(headers({ 'x-vercel-forwarded-for': value }))).toEqual(unresolved(reason));
  });
});

describe('client address: source "proxies"', () => {
  it('takes the first untrusted hop from the right, never the left-most one', () => {
    const resolve = behind('10.0.0.0/8');

    expect(resolve(headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.7, 10.0.0.5' }))).toEqual(
      resolved('203.0.113.7'),
    );
  });

  it('cannot be steered by a client that prepends addresses', () => {
    const resolve = behind('10.0.0.0/8');
    const honest = resolve(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.5' }));
    const forged = resolve(
      headers({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 203.0.113.7, 10.0.0.5' }),
    );

    expect(forged).toEqual(honest);
  });

  it('treats the nearest proxy-appended hop as the client when it is the only one', () => {
    expect(behind('10.0.0.0/8')(headers({ 'x-forwarded-for': '203.0.113.7' }))).toEqual(
      resolved('203.0.113.7'),
    );
  });

  it('skips several trusted proxies in a row, including exact addresses and ranges', () => {
    const resolve = behind('10.0.0.1', '172.16.0.0/12');

    expect(resolve(headers({ 'x-forwarded-for': '203.0.113.7, 172.20.1.1, 10.0.0.1' }))).toEqual(
      resolved('203.0.113.7'),
    );
  });

  it('is unresolved when every hop is a trusted proxy', () => {
    expect(behind('10.0.0.0/8')(headers({ 'x-forwarded-for': '10.1.1.1, 10.2.2.2' }))).toEqual(
      unresolved('no_untrusted_hop'),
    );
  });

  it('distrusts the whole header when any hop on the way is malformed', () => {
    const resolve = behind('10.0.0.0/8');

    expect(resolve(headers({ 'x-forwarded-for': '203.0.113.7, garbage, 10.0.0.5' }))).toEqual(
      unresolved('header_malformed'),
    );
    expect(resolve(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.5, garbage' }))).toEqual(
      unresolved('header_malformed'),
    );
  });

  it('is unresolved without the header, and ignores the platform header', () => {
    expect(behind('10.0.0.0/8')(headers({ 'x-vercel-forwarded-for': '203.0.113.7' }))).toEqual(
      unresolved('header_missing'),
    );
  });

  it('matches an IPv4 proxy that reports itself in IPv4-mapped IPv6 form', () => {
    expect(
      behind('10.0.0.0/8')(headers({ 'x-forwarded-for': '203.0.113.7, ::ffff:10.0.0.5' })),
    ).toEqual(resolved('203.0.113.7'));
  });

  it('matches IPv6 proxy ranges', () => {
    expect(
      behind('2001:db8::/32')(headers({ 'x-forwarded-for': '203.0.113.7, 2001:db8:abcd::1' })),
    ).toEqual(resolved('203.0.113.7'));
  });

  it('refuses to start without a trusted proxy or with a malformed entry', () => {
    expect(() => behind()).toThrow(/at least one trusted proxy/);
    expect(() => behind('not-an-ip')).toThrow(/Invalid trusted proxy/);
    expect(() => behind('::ffff:10.0.0.0/104')).toThrow(/plain IPv4/);
  });
});

describe('client address: normalisation', () => {
  const resolve = (value: string) => vercel(headers({ 'x-vercel-forwarded-for': value }));

  it('keeps an IPv4 address as it is', () => {
    expect(resolve('203.0.113.7')).toEqual(resolved('203.0.113.7'));
  });

  it('counts an IPv4-mapped IPv6 address as its IPv4 address', () => {
    expect(resolve('::ffff:203.0.113.7')).toEqual(resolved('203.0.113.7'));
    expect(resolve('::FFFF:cb00:7107')).toEqual(resolved('203.0.113.7'));
  });

  it('reduces IPv6 to its /64, so rotating through a subscriber range changes nothing', () => {
    const expected = resolved('2001:0db8:0001:0002:0000:0000:0000:0000');

    expect(resolve('2001:db8:1:2::1')).toEqual(expected);
    expect(resolve('2001:DB8:1:2:ffff:ffff:ffff:ffff')).toEqual(expected);
    expect(resolve('2001:db8:1:2:0:0:0:abcd')).toEqual(expected);
  });

  it('keeps different /64 networks apart', () => {
    expect(resolve('2001:db8:1:2::1')).not.toEqual(resolve('2001:db8:1:3::1'));
  });

  it('handles compressed, zero-leading and zone-id forms of the same network', () => {
    const expected = resolved('fe80:0000:0000:0000:0000:0000:0000:0000');

    expect(resolve('fe80::1')).toEqual(expected);
    expect(resolve('fe80::1%eth0')).toEqual(expected);
    expect(resolve('FE80:0:0:0::1')).toEqual(expected);
  });

  it('handles the IPv6 loopback and an embedded IPv4 tail without throwing', () => {
    expect(resolve('::1')).toEqual(resolved('0000:0000:0000:0000:0000:0000:0000:0000'));
    expect(resolve('64:ff9b::203.0.113.7')).toEqual(
      resolved('0064:ff9b:0000:0000:0000:0000:0000:0000'),
    );
  });
});
