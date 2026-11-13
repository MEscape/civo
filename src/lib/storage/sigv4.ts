import { createHash, createHmac } from 'node:crypto';

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 's3';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';
const HEX_RADIX = 16;
/** `20261018` of `20261018T100000Z`: the day a signing key is scoped to. */
const DATE_LENGTH = 8;
const EMPTY_PAYLOAD_SHA256 = createHash('sha256').update('').digest('hex');

/** The access key and the region the service signs for. The secret is only ever used to sign. */
export interface SigV4Credentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
}

interface SignInput {
  readonly method: string;
  readonly url: URL;
  /** Extra headers to sign. Names are case-insensitive; `host` is added from the URL. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly now: Date;
}

const sha256Hex = (data: string) => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data).digest();

/** `20261018T100000Z`, the form SigV4 signs. */
const amzDate = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, '');

/** RFC 3986 percent-encoding as SigV4 demands; `encodeURIComponent` leaves `!'()*` alone. */
const encode = (text: string) =>
  encodeURIComponent(text).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(HEX_RADIX).toUpperCase()}`,
  );

function canonicalQuery(url: URL): string {
  return [...url.searchParams]
    .map(([name, value]) => [encode(name), encode(value)] as const)
    .sort(([a], [b]) => (a < b ? -1 : 1)) // names are unique, so there is no tie to break
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

function canonicalHeaders(headers: Readonly<Record<string, string>>) {
  const entries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, ' ')] as const)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return {
    block: entries.map(([name, value]) => `${name}:${value}\n`).join(''),
    names: entries.map(([name]) => name).join(';'),
  };
}

function scopeOf(credentials: SigV4Credentials, stamp: string): string {
  return `${stamp.slice(0, DATE_LENGTH)}/${credentials.region}/${SERVICE}/aws4_request`;
}

/**
 * The signature of a canonical request. The path is used as the URL has it: the endpoint, bucket
 * and object key reach this module already restricted to unreserved characters (see
 * `request-validation.ts` and the bucket pattern in the storage configuration), so nothing in it
 * needs a second round of encoding.
 */
function signature(credentials: SigV4Credentials, stamp: string, canonicalRequest: string): string {
  const key = [credentials.region, SERVICE, 'aws4_request'].reduce(
    (secret, part) => hmac(secret, part),
    hmac(`AWS4${credentials.secretAccessKey}`, stamp.slice(0, DATE_LENGTH)),
  );
  const toSign = [ALGORITHM, stamp, scopeOf(credentials, stamp), sha256Hex(canonicalRequest)];
  return hmac(key, toSign.join('\n')).toString('hex');
}

/**
 * A request authenticated by its `Authorization` header, for calls the server makes itself
 * (`HEAD`, ranged `GET`, `DELETE`). Bodies are not supported: the payload hash is that of nothing.
 */
export function signRequest(credentials: SigV4Credentials, input: SignInput): Request {
  const stamp = amzDate(input.now);
  const sent = {
    ...input.headers,
    'x-amz-content-sha256': EMPTY_PAYLOAD_SHA256,
    'x-amz-date': stamp,
  };
  const { block, names } = canonicalHeaders({ ...sent, host: input.url.host });
  const canonicalRequest = [
    input.method,
    input.url.pathname,
    canonicalQuery(input.url),
    block,
    names,
    EMPTY_PAYLOAD_SHA256,
  ].join('\n');

  const authorization =
    `${ALGORITHM} Credential=${credentials.accessKeyId}/${scopeOf(credentials, stamp)},` +
    `SignedHeaders=${names},Signature=${signature(credentials, stamp, canonicalRequest)}`;
  return new Request(input.url, {
    method: input.method,
    headers: { ...sent, authorization },
  });
}

/**
 * A URL that carries its own authentication in the query string (a presigned URL), valid for
 * `expiresInSeconds`. The headers given are signed too, so the holder must send exactly those. The
 * payload is not signed (`UNSIGNED-PAYLOAD`), as for every presigned S3 URL.
 */
export function presignUrl(
  credentials: SigV4Credentials,
  input: SignInput & { readonly expiresInSeconds: number },
): string {
  const stamp = amzDate(input.now);
  const target = new URL(input.url);
  target.searchParams.set('X-Amz-Algorithm', ALGORITHM);
  target.searchParams.set(
    'X-Amz-Credential',
    `${credentials.accessKeyId}/${scopeOf(credentials, stamp)}`,
  );
  target.searchParams.set('X-Amz-Date', stamp);
  target.searchParams.set('X-Amz-Expires', String(input.expiresInSeconds));

  const { block, names } = canonicalHeaders({ ...input.headers, host: input.url.host });
  target.searchParams.set('X-Amz-SignedHeaders', names);

  const canonicalRequest = [
    input.method,
    target.pathname,
    canonicalQuery(target),
    block,
    names,
    UNSIGNED_PAYLOAD,
  ].join('\n');
  target.searchParams.set('X-Amz-Signature', signature(credentials, stamp, canonicalRequest));
  return target.href;
}
