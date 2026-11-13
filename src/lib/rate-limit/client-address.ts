import type { ClientAddressSettings } from '@lib/config/server';

import {
  buildTrustedProxyList,
  isTrusted,
  normaliseAddress,
  parseHop,
  parseIp,
} from './ip-address';

/** The part of `Headers` the resolver reads, so tests and adapters need not build a real one. */
export interface HeaderReader {
  get(name: string): string | null;
}

/** Why no trustworthy client address could be determined. Safe to log. */
export type UnresolvedReason =
  /** The header the source relies on is absent (running outside the trusted platform or proxy). */
  | 'header_missing'
  /** A hop is not an IP address. The whole header is distrusted, not partly used. */
  | 'header_malformed'
  /** More than one address where the platform sets exactly one. */
  | 'ambiguous_header'
  /** Every hop is a trusted proxy, so none of them is the client. */
  | 'no_untrusted_hop'
  /** There is no request to read (build time, a background job, a test). */
  | 'no_request';

export type ClientAddress =
  | { readonly status: 'resolved'; readonly address: string }
  | { readonly status: 'unresolved'; readonly reason: UnresolvedReason };

/**
 * The one header each platform sets itself with the client's address, replacing whatever the client
 * sent under that name. Oracle Cloud load balancers, Azure Application Gateway and App Service and
 * most proxies of your own append to `x-forwarded-for` instead: that is the `proxies` source.
 */
const PLATFORM_HEADERS: Readonly<
  Record<Exclude<ClientAddressSettings['source'], 'proxies'>, string>
> = {
  vercel: 'x-vercel-forwarded-for',
  cloudflare: 'cf-connecting-ip',
  azure: 'x-azure-clientip',
};
const FORWARDED_FOR_HEADER = 'x-forwarded-for';

function splitHops(value: string): string[] {
  return value
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);
}

/**
 * Builds the function that turns request headers into a client address.
 *
 * Trust is explicit and narrow; there is no mode that believes an arbitrary header:
 *
 * - `vercel`, `cloudflare`, `azure`: only the header that platform sets itself
 *   (`x-vercel-forwarded-for`, `cf-connecting-ip`, `x-azure-clientip`; a value sent by the client
 *   does not reach the app). Exactly one address is accepted. Sound only while the application can
 *   be reached through that platform alone: a request that bypasses it can send the header itself.
 * - `proxies`: `x-forwarded-for` read from the right, skipping hops that are in
 *   `trustedProxies`; the first hop that is not one of them is the client. The left-most entry
 *   is never used on its own, because the client controls it, and nothing to the left of the
 *   client hop is read at all. A malformed hop met on the way (before the client is found)
 *   distrusts the whole header. This is only sound if the app is reachable solely through those
 *   proxies.
 *
 * Throws on a malformed trusted-proxy list or a `proxies` source without one; configuration
 * validation reports both at startup, so this is a backstop.
 */
export function createClientAddressResolver(
  settings: ClientAddressSettings,
): (headers: HeaderReader) => ClientAddress {
  const trusted =
    settings.source === 'proxies' ? buildTrustedProxyList(settings.trustedProxies) : null;
  if (settings.source === 'proxies' && settings.trustedProxies.length === 0) {
    throw new Error('The "proxies" source needs at least one trusted proxy.');
  }

  const unresolved = (reason: UnresolvedReason): ClientAddress => ({
    status: 'unresolved',
    reason,
  });

  function fromPlatformHeader(headerName: string) {
    return (headers: HeaderReader): ClientAddress => resolvePlatformHeader(headers, headerName);
  }

  function resolvePlatformHeader(headers: HeaderReader, headerName: string): ClientAddress {
    const hops = splitHops(headers.get(headerName) ?? '');
    const [only] = hops;
    if (only === undefined) {
      return unresolved('header_missing');
    }
    if (hops.length > 1) {
      return unresolved('ambiguous_header');
    }
    const parsed = parseIp(only);
    return parsed === null
      ? unresolved('header_malformed')
      : { status: 'resolved', address: normaliseAddress(parsed) };
  }

  function fromForwardedFor(headers: HeaderReader): ClientAddress {
    const value = headers.get(FORWARDED_FOR_HEADER);
    if (value === null) {
      return unresolved('header_missing');
    }

    // Walk from the right end, one hop at a time, without splitting the rest. The left of this
    // header is written by the client, so its length is the attacker's to choose: the cost here
    // stays proportional to the trusted hops plus one. And never turn the length or content of
    // the left into "unresolved": with the default `skip` mode that would mean "not limited".
    let end = value.length;
    let sawHop = false;
    while (end > 0) {
      const comma = value.lastIndexOf(',', end - 1);
      const hop = value.slice(comma + 1, end).trim();
      end = comma === -1 ? 0 : comma;
      if (hop.length === 0) {
        continue;
      }
      sawHop = true;

      const parsed = parseHop(hop);
      if (parsed === null) {
        return unresolved('header_malformed');
      }
      if (trusted !== null && isTrusted(trusted, parsed)) {
        continue;
      }
      return { status: 'resolved', address: normaliseAddress(parsed) };
    }
    return unresolved(sawHop ? 'no_untrusted_hop' : 'header_missing');
  }

  return settings.source === 'proxies'
    ? fromForwardedFor
    : fromPlatformHeader(PLATFORM_HEADERS[settings.source]);
}
