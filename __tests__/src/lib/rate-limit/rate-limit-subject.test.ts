import { describe, expect, it } from 'vitest';

import { MAX_SUBJECT_PART_LENGTH, buildBucketKey } from '@lib/rate-limit/rate-limit-subject';
import type { RateLimitSubject } from '@lib/rate-limit/rate-limit-subject';

import { SECRET } from './support';

function keyOf(subject: RateLimitSubject, policyId = 'test.operation', secret = SECRET): string {
  const result = buildBucketKey(policyId, subject, secret);
  if (!result.isValid) {
    throw new Error(result.problem);
  }
  return result.key;
}

describe('buildBucketKey', () => {
  it('builds <policy>:<kind>:<64 hex> and is deterministic', () => {
    const subject = { kind: 'identifier', value: 'person@example.org' } as const;
    expect(keyOf(subject)).toMatch(/^test\.operation:identifier:[0-9a-f]{64}$/);
    expect(keyOf(subject)).toBe(keyOf(subject));
  });

  it('never contains the raw email, address or ids', () => {
    expect(keyOf({ kind: 'identifier', value: 'person@example.org' })).not.toContain('person');
    expect(keyOf({ kind: 'client', address: '203.0.113.7' })).not.toContain('203');
    expect(keyOf({ kind: 'actor', tenantId: 'tenant-1', actorId: 'user-42' })).not.toContain(
      'user',
    );
  });

  it('depends on the secret, so the table cannot be reversed without it', () => {
    const subject = { kind: 'client', address: '203.0.113.7' } as const;
    expect(keyOf(subject, 'test.operation', 'a'.repeat(32))).not.toBe(
      keyOf(subject, 'test.operation', 'b'.repeat(32)),
    );
  });

  it('separates kinds that share the same text', () => {
    const keys = new Set([
      keyOf({ kind: 'identifier', value: 'same' }),
      keyOf({ kind: 'client', address: 'same' }),
    ]);
    expect(keys.size).toBe(2);
  });

  it('hashes the kind in as well as writing it in the key, so the digest alone never collides across kinds', () => {
    const digestOf = (key: string) => key.split(':').at(-1);

    expect(digestOf(keyOf({ kind: 'identifier', value: 'same' }))).not.toBe(
      digestOf(keyOf({ kind: 'client', address: 'same' })),
    );
  });

  it('separates policies', () => {
    const subject = { kind: 'client', address: '203.0.113.7' } as const;
    expect(keyOf(subject, 'a.one')).not.toBe(keyOf(subject, 'a.two'));
  });

  it('keeps tenants apart even for the same actor id', () => {
    expect(keyOf({ kind: 'actor', tenantId: 't1', actorId: 'u' })).not.toBe(
      keyOf({ kind: 'actor', tenantId: 't2', actorId: 'u' }),
    );
  });

  it('cannot be confused by moving a character between fields', () => {
    expect(keyOf({ kind: 'actor', tenantId: 'a', actorId: 'bc' })).not.toBe(
      keyOf({ kind: 'actor', tenantId: 'ab', actorId: 'c' }),
    );
  });

  it('normalises identifiers: case, surrounding space and Unicode compatibility forms', () => {
    const canonical = keyOf({ kind: 'identifier', value: 'abc@example.org' });
    expect(keyOf({ kind: 'identifier', value: '  ABC@Example.ORG ' })).toBe(canonical);
    expect(keyOf({ kind: 'identifier', value: 'ａｂｃ@example.org' })).toBe(canonical);
  });

  it('refuses to build a key for an unresolved client: there is no shared counter for strangers', () => {
    expect(buildBucketKey('test.operation', { kind: 'unresolved-client' }, SECRET)).toMatchObject({
      isValid: false,
    });
  });

  it('gives the global subject one shared, readable key', () => {
    expect(keyOf({ kind: 'global' })).toBe('test.operation:global');
  });

  it.each([
    { kind: 'identifier', value: '' },
    { kind: 'identifier', value: '   ' },
    { kind: 'client', address: '' },
    { kind: 'actor', tenantId: '', actorId: 'u' },
    { kind: 'actor', tenantId: 't', actorId: '' },
  ] as const)('refuses an empty subject %j', (subject) => {
    expect(buildBucketKey('test.operation', subject, SECRET)).toMatchObject({ isValid: false });
  });

  it('refuses an oversized value instead of growing the table, and gives valid ones a fixed-length key', () => {
    const tooLong = 'x'.repeat(MAX_SUBJECT_PART_LENGTH + 1);
    expect(
      buildBucketKey('test.operation', { kind: 'identifier', value: tooLong }, SECRET),
    ).toMatchObject({
      isValid: false,
    });

    const atLimit = 'y'.repeat(MAX_SUBJECT_PART_LENGTH);
    const short = keyOf({ kind: 'identifier', value: 'y' });
    expect(keyOf({ kind: 'identifier', value: atLimit })).toHaveLength(short.length);
  });
});
