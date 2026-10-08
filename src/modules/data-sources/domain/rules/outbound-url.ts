import { isDefined } from '@lib/utils';

/**
 * SSRF guard for URLs the SERVER fetches on an administrator's behalf.
 *
 * Distinct from rendering a link: here the danger points the other way, an
 * administrator-supplied URL reaching the server's own network (cloud
 * metadata, localhost, internal services).
 *
 * The domain never resolves DNS. Two complementary checks are exported:
 *
 * - checkOutboundUrl: hostname-level (scheme, blocked names, literal IPs),
 *   used at save time and again before every request.
 * - isPublicAddress: the same address policy for an IP the infrastructure
 *   layer obtained from DNS, which closes the "public hostname that resolves
 *   to a private address" hole.
 */

const BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '0.0.0.0', '[::1]', '::1']);

const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost'] as const;

const IPV4_OCTET_COUNT = 4;
const IPV4_BITS = 32;
const BITS_PER_OCTET = 8;
const OCTET_MAX = 255;
const IPV4_UNSIGNED_SHIFT = 0;
const IPV4_PREFIX_LENGTH = 8;
const IPV4_PRIVATE_PREFIX_LENGTH = 12;
const IPV4_LINK_LOCAL_PREFIX_LENGTH = 16;
const IPV4_CARRIER_NAT_PREFIX_LENGTH = 10;
const IPV4_PROTOCOL_PREFIX_LENGTH = 24;
const IPV4_BENCHMARK_PREFIX_LENGTH = 15;
const IPV4_MULTICAST_PREFIX_LENGTH = 4;

const IPV4_OCTET_SHIFTS = Array.from(
  { length: IPV4_OCTET_COUNT },
  (_, index) => BITS_PER_OCTET * (IPV4_OCTET_COUNT - index - 1),
) as unknown as readonly [number, number, number, number];

const IPV4_OCTET_PATTERN = /^\d{1,3}$/;
const IPV6_MAPPED_DOTTED_PATTERN = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/;
const IPV6_MAPPED_HEX_PATTERN = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;
const IPV6_GLOBAL_UNICAST_FIRST_HEXTET_PATTERN = /^[23][0-9a-f]{3}$/;

const HEX_RADIX = 16;

const IPV6_DOCUMENTATION_PREFIX = '2001:db8:';
const IPV6_DOCUMENTATION_PREFIX_EXPANDED = '2001:0db8:';

export type OutboundRejection =
  'invalid_url' | 'scheme_not_allowed' | 'credentials_not_allowed' | 'address_not_allowed';

export type OutboundUrlDecision =
  | { readonly isAllowed: true; readonly url: URL }
  | { readonly isAllowed: false; readonly reason: OutboundRejection };

type Ipv4Octets = readonly [a: number, b: number, c: number, d: number];
type Ipv4Range = readonly [start: number, end: number];
type Ipv4Cidr = readonly [address: Ipv4Octets, prefixLength: number];

function ipv4ToInt(octets: Ipv4Octets): number {
  return (
    octets.reduce((result, octet, index) => {
      const shift = IPV4_OCTET_SHIFTS[index];

      return shift === undefined ? result : result | (octet << shift);
    }, IPV4_UNSIGNED_SHIFT) >>> IPV4_UNSIGNED_SHIFT
  );
}

function cidr([octets, prefixLength]: Ipv4Cidr): Ipv4Range {
  const start = ipv4ToInt(octets);
  const addressCount = 2 ** (IPV4_BITS - prefixLength);

  return [start, start + addressCount - 1];
}

/**
 * Full CIDR math rather than string prefixes, so public neighbours such as
 * 172.200.0.0 are not over-blocked.
 */
/* eslint-disable no-magic-numbers -- IPv4 octets and CIDR prefix lengths are protocol-defined values in this security policy. */
const BLOCKED_IPV4_RANGES: readonly Ipv4Range[] = [
  cidr([[0, 0, 0, 0], IPV4_PREFIX_LENGTH]), // "this" network
  cidr([[10, 0, 0, 0], IPV4_PREFIX_LENGTH]), // RFC 1918 private
  cidr([[100, 64, 0, 0], IPV4_CARRIER_NAT_PREFIX_LENGTH]), // carrier-grade NAT
  cidr([[127, 0, 0, 0], IPV4_PREFIX_LENGTH]), // loopback
  cidr([[169, 254, 0, 0], IPV4_LINK_LOCAL_PREFIX_LENGTH]), // link-local (cloud metadata endpoints)
  cidr([[172, 16, 0, 0], IPV4_PRIVATE_PREFIX_LENGTH]), // RFC 1918 private
  cidr([[192, 0, 0, 0], IPV4_PROTOCOL_PREFIX_LENGTH]), // IETF protocol assignments
  cidr([[192, 168, 0, 0], IPV4_PRIVATE_PREFIX_LENGTH]), // RFC 1918 private
  cidr([[198, 18, 0, 0], IPV4_BENCHMARK_PREFIX_LENGTH]), // benchmarking
  cidr([[224, 0, 0, 0], IPV4_MULTICAST_PREFIX_LENGTH]), // multicast
  cidr([[240, 0, 0, 0], IPV4_MULTICAST_PREFIX_LENGTH]), // reserved + broadcast
];
/* eslint-enable no-magic-numbers -- Restore magic-number checks after the IPv4 CIDR table. */

function parseIpv4(address: string): number | null {
  const parts = address.split('.');

  if (parts.length !== IPV4_OCTET_COUNT || !parts.every((part) => IPV4_OCTET_PATTERN.test(part))) {
    return null;
  }

  const [a, b, c, d] = parts.map(Number);

  if (a === undefined || b === undefined || c === undefined || d === undefined) {
    return null;
  }

  if ([a, b, c, d].some((octet) => octet > OCTET_MAX)) {
    return null;
  }

  return ipv4ToInt([a, b, c, d]);
}

function isBlockedIpv4(address: string): boolean {
  const value = parseIpv4(address);

  if (value === null) {
    return false;
  }

  return BLOCKED_IPV4_RANGES.some(([start, end]) => value >= start && value <= end);
}

function embeddedIpv4(ipv6: string): string | null {
  const dotted = IPV6_MAPPED_DOTTED_PATTERN.exec(ipv6);

  if (isDefined(dotted?.[1])) {
    return dotted[1];
  }

  const hex = IPV6_MAPPED_HEX_PATTERN.exec(ipv6);

  if (hex?.[1] === undefined || hex[2] === undefined) {
    return null;
  }

  const high = Number.parseInt(hex[1], HEX_RADIX);
  const low = Number.parseInt(hex[2], HEX_RADIX);

  return [high >> BITS_PER_OCTET, high & OCTET_MAX, low >> BITS_PER_OCTET, low & OCTET_MAX].join(
    '.',
  );
}

/**
 * Only globally routable unicast IPv6 (2000::/3) can be public.
 * Loopback, link-local, unique-local, unspecified, multicast and the
 * documentation prefix are refused.
 */
function isBlockedIpv6(address: string): boolean {
  const mapped = embeddedIpv4(address);

  if (mapped !== null) {
    return isBlockedIpv4(mapped);
  }

  const firstGroup = address.split(':')[0] ?? '';

  if (!IPV6_GLOBAL_UNICAST_FIRST_HEXTET_PATTERN.test(firstGroup)) {
    return true;
  }

  return (
    address.startsWith(IPV6_DOCUMENTATION_PREFIX) ||
    address.startsWith(IPV6_DOCUMENTATION_PREFIX_EXPANDED)
  );
}

function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, '');
}

function isBlockedAddress(address: string): boolean {
  const normalized = address.toLowerCase();

  return normalized.includes(':') ? isBlockedIpv6(normalized) : isBlockedIpv4(normalized);
}

function reject(reason: OutboundRejection): OutboundUrlDecision {
  return { isAllowed: false, reason };
}

export function checkOutboundUrl(rawUrl: string): OutboundUrlDecision {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return reject('invalid_url');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return reject('scheme_not_allowed');
  }

  if (url.username !== '' || url.password !== '') {
    return reject('credentials_not_allowed');
  }

  const hostname = normalizeHostname(url.hostname);

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return reject('address_not_allowed');
  }

  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return reject('address_not_allowed');
  }

  if (isBlockedAddress(stripBrackets(hostname))) {
    return reject('address_not_allowed');
  }

  return { isAllowed: true, url };
}

export function isPublicAddress(address: string): boolean {
  return !isBlockedAddress(stripBrackets(address));
}
