// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { presignUrl, signRequest } from '@lib/storage/sigv4';
import type { SigV4Credentials } from '@lib/storage/sigv4';

// The examples AWS publishes for Signature Version 4 on S3, signed byte for byte:
// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
const AWS_EXAMPLE = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
} as const;
const AWS_EXAMPLE_TIME = new Date('2013-05-24T00:00:00.000Z');

describe('presignUrl', () => {
  it('reproduces the presigned GET AWS documents', () => {
    const signed = new URL(
      presignUrl(AWS_EXAMPLE, {
        method: 'GET',
        url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
        now: AWS_EXAMPLE_TIME,
        expiresInSeconds: 86_400,
      }),
    );

    expect(signed.searchParams.get('X-Amz-Signature')).toBe(
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
    expect(signed.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(signed.searchParams.get('X-Amz-Credential')).toBe(
      'AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request',
    );
  });

  it('signs the headers it is given, lower-cased and in order', () => {
    const signed = new URL(
      presignUrl(AWS_EXAMPLE, {
        method: 'PUT',
        url: new URL('http://127.0.0.1:8333/bucket/a/b'),
        headers: { 'Content-Type': 'image/png', 'cache-control': 'max-age=60' },
        now: AWS_EXAMPLE_TIME,
        expiresInSeconds: 300,
      }),
    );

    expect(signed.searchParams.get('X-Amz-SignedHeaders')).toBe('cache-control;content-type;host');
  });

  it('gives a different signature for a different key, header or secret', () => {
    const base = {
      method: 'PUT',
      url: new URL('https://s3.example.org/bucket/a'),
      headers: { 'content-type': 'image/png' },
      now: AWS_EXAMPLE_TIME,
      expiresInSeconds: 300,
    };
    const signatureOf = (
      credentials: SigV4Credentials = AWS_EXAMPLE,
      overrides: Partial<typeof base> = {},
    ) =>
      new URL(presignUrl(credentials, { ...base, ...overrides })).searchParams.get(
        'X-Amz-Signature',
      );

    const original = signatureOf();
    expect(signatureOf(AWS_EXAMPLE, { url: new URL('https://s3.example.org/bucket/b') })).not.toBe(
      original,
    );
    expect(signatureOf(AWS_EXAMPLE, { headers: { 'content-type': 'image/jpeg' } })).not.toBe(
      original,
    );
    expect(signatureOf({ ...AWS_EXAMPLE, secretAccessKey: 'another' })).not.toBe(original);
  });

  it('leaves the secret out of the URL', () => {
    const url = presignUrl(AWS_EXAMPLE, {
      method: 'GET',
      url: new URL('https://s3.example.org/bucket/a'),
      now: AWS_EXAMPLE_TIME,
      expiresInSeconds: 60,
    });

    expect(url).not.toContain(AWS_EXAMPLE.secretAccessKey);
    expect(url).not.toContain(encodeURIComponent(AWS_EXAMPLE.secretAccessKey));
  });
});

describe('signRequest', () => {
  it('reproduces the ranged GET AWS documents', () => {
    const request = signRequest(AWS_EXAMPLE, {
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      headers: { Range: 'bytes=0-9' },
      now: AWS_EXAMPLE_TIME,
    });

    expect(request.headers.get('authorization')).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,' +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
    expect(request.headers.get('x-amz-date')).toBe('20130524T000000Z');
    expect(request.headers.get('x-amz-content-sha256')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('signs query parameters in name order, whatever order the URL lists them in', () => {
    const signatureOf = (query: string) =>
      signRequest(AWS_EXAMPLE, {
        method: 'GET',
        url: new URL(`https://s3.example.org/bucket?${query}`),
        now: AWS_EXAMPLE_TIME,
      }).headers.get('authorization');

    expect(signatureOf('b=2&a=1&c=a%20b')).toBe(signatureOf('a=1&b=2&c=a%20b'));
    expect(signatureOf('a=1')).not.toBe(signatureOf('a=2'));
    // RFC 3986 reserves !'()*, which encodeURIComponent leaves alone.
    expect(signatureOf("a=!'()*")).toBe(signatureOf('a=%21%27%28%29%2A'));
  });

  it('sends the method and URL it signed, without the secret', () => {
    const request = signRequest(AWS_EXAMPLE, {
      method: 'DELETE',
      url: new URL('https://s3.example.org/bucket/a'),
      now: AWS_EXAMPLE_TIME,
    });

    expect(request.method).toBe('DELETE');
    expect(request.url).toBe('https://s3.example.org/bucket/a');
    expect([...request.headers.values()].join(' ')).not.toContain(AWS_EXAMPLE.secretAccessKey);
  });
});
