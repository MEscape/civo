import { BlockList, isIP } from 'node:net';

/*
 * IP address text to the form a rate limit counts under, and the trusted-proxy list a forwarded
 * hop is checked against. Header trust policy (which header, which hop) is `client-address.ts`.
 */

const IPV6_GROUPS = 8;
const IPV6_GROUP_WIDTH = 4;
const IPV6_SUBNET_GROUPS = 4; // /64
const HEX = 16;
const BYTE = 256;
const FAMILY_V4 = 4;
const FAMILY_V6 = 6;
const IPV4_MAPPED_PREFIX_GROUPS = 5;
const IPV4_MAPPED_MARKER = 'ffff';
const ZERO_GROUP = '0000';
const CIDR_PREFIX_PATTERN = /^\d+$/;

/** An IP address in a form two spellings of the same host share. */
interface ParsedIp {
  readonly family: typeof FAMILY_V4 | typeof FAMILY_V6;
  /** Dotted IPv4, or the eight lower-case 4-digit groups of an IPv6 address. */
  readonly canonical: string;
}

/** Expands any valid IPv6 text (compressed, zone id, embedded IPv4 tail) to eight 4-digit groups. */
function expandIpv6(text: string): string[] {
  let source = text.toLowerCase();
  const zone = source.indexOf('%');
  if (zone !== -1) {
    source = source.slice(0, zone);
  }

  const lastColon = source.lastIndexOf(':');
  const tail = source.slice(lastColon + 1);
  if (tail.includes('.')) {
    const [a = 0, b = 0, c = 0, d = 0] = tail.split('.').map(Number);
    const high = (a * BYTE + b).toString(HEX);
    const low = (c * BYTE + d).toString(HEX);
    source = `${source.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const [head = '', rest] = source.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = rest === undefined || rest === '' ? [] : rest.split(':');
  const zeros = rest === undefined ? 0 : IPV6_GROUPS - left.length - right.length;

  return [...left, ...Array.from({ length: zeros }, () => '0'), ...right].map((group) =>
    group.padStart(IPV6_GROUP_WIDTH, '0'),
  );
}

/**
 * The address in canonical form, or `null` when the text is not an IP address at all. An
 * IPv4-mapped IPv6 address (`::ffff:203.0.113.9`) is returned as the IPv4 address it stands for.
 */
export function parseIp(text: string): ParsedIp | null {
  const family = isIP(text);
  if (family === FAMILY_V4) {
    return { family: FAMILY_V4, canonical: text };
  }
  if (family !== FAMILY_V6) {
    return null;
  }

  const groups = expandIpv6(text);
  const isMappedV4 =
    groups.slice(0, IPV4_MAPPED_PREFIX_GROUPS).every((group) => group === ZERO_GROUP) &&
    groups[IPV4_MAPPED_PREFIX_GROUPS] === IPV4_MAPPED_MARKER;
  if (isMappedV4) {
    const [high = ZERO_GROUP, low = ZERO_GROUP] = groups.slice(IPV4_MAPPED_PREFIX_GROUPS + 1);
    const octets = [high.slice(0, 2), high.slice(2), low.slice(0, 2), low.slice(2)];
    return { family: FAMILY_V4, canonical: octets.map((octet) => parseInt(octet, HEX)).join('.') };
  }
  return { family: FAMILY_V6, canonical: groups.join(':') };
}

/**
 * The key an address is counted under. An IPv4-mapped IPv6 address is the same client as its
 * IPv4 form. An IPv6 address is reduced to its /64 network: one subscriber commonly controls
 * the whole /64, so counting single addresses would let a client rotate through billions of
 * them. The result matches the normalisation Better Auth applies to its own IP limits.
 */
export function normaliseAddress(parsed: ParsedIp): string {
  if (parsed.family === FAMILY_V4) {
    return parsed.canonical;
  }
  return [
    ...parsed.canonical.split(':').slice(0, IPV6_SUBNET_GROUPS),
    ...Array.from({ length: IPV6_GROUPS - IPV6_SUBNET_GROUPS }, () => ZERO_GROUP),
  ].join(':');
}

function addTrustedProxy(list: BlockList, entry: string): void {
  const slash = entry.lastIndexOf('/');
  const addressText = slash === -1 ? entry : entry.slice(0, slash);
  const prefixText = slash === -1 ? undefined : entry.slice(slash + 1);
  const parsed = parseIp(addressText);

  // Configuration is validated at startup; reaching a throw here means that was bypassed.
  if (parsed === null || (prefixText !== undefined && !CIDR_PREFIX_PATTERN.test(prefixText))) {
    throw new Error('Invalid trusted proxy entry.');
  }
  if (prefixText !== undefined && isIP(addressText) === FAMILY_V6 && parsed.family === FAMILY_V4) {
    // Hops are compared in their IPv4 form, so a range written for the mapped form would
    // silently match nothing. Refuse it instead.
    throw new Error('Write an IPv4-mapped trusted proxy range as plain IPv4.');
  }

  const type = parsed.family === FAMILY_V4 ? 'ipv4' : 'ipv6';
  const address = parsed.family === FAMILY_V4 ? parsed.canonical : compressForBlockList(parsed);
  if (prefixText === undefined) {
    list.addAddress(address, type);
  } else {
    list.addSubnet(address, Number(prefixText), type);
  }
}

const IPV4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;
const BRACKETED_IPV6 = /^\[([^\]]+)\](?::\d{1,5})?$/;

/**
 * One hop of a forwarded header. Some proxies append `address:port` (Azure App Service and
 * Application Gateway, for IPv4) or `[address]:port`; the port is not part of the client, so it is
 * dropped. Anything else that is not an IP address is `null`.
 */
export function parseHop(text: string): ParsedIp | null {
  const withoutPort = IPV4_WITH_PORT.exec(text)?.[1] ?? BRACKETED_IPV6.exec(text)?.[1] ?? text;
  return parseIp(withoutPort);
}

/**
 * The trusted proxies as a list that can be asked about a hop. An entry is an address or an
 * `address/prefix` range.
 *
 * @throws Error for an entry that is not one (configuration validation reports it at startup first)
 */
export function buildTrustedProxyList(entries: readonly string[]): BlockList {
  const list = new BlockList();
  for (const entry of entries) {
    addTrustedProxy(list, entry);
  }
  return list;
}

/** `BlockList` takes ordinary IPv6 text, not the zero-padded groups used internally. */
function compressForBlockList(parsed: ParsedIp): string {
  return parsed.canonical
    .split(':')
    .map((group) => parseInt(group, HEX).toString(HEX))
    .join(':');
}

/** Whether a hop is one of the trusted proxies (so it is not the client). */
export function isTrusted(list: BlockList, parsed: ParsedIp): boolean {
  return parsed.family === FAMILY_V4
    ? list.check(parsed.canonical, 'ipv4')
    : list.check(compressForBlockList(parsed), 'ipv6');
}
