import { createHmac } from 'node:crypto';

/**
 * Who a budget is counted against. A closed set of shapes, never a raw string,
 * so a caller cannot invent a key that is too broad (everyone shares it) or
 * unbounded (one per request).
 *
 * - `actor`: a signed-in user. Build it from the trusted `Actor` a use case got
 *   from authorization, never from request input.
 * - `client`: a network address that was already resolved from trusted request
 *   metadata and normalised by the caller.
 * - `identifier`: an account identifier such as an email address. Normalised
 *   here (Unicode NFKC, trimmed, lower-cased) and stored only as a keyed hash.
 * - `unresolved-client`: the client address could not be determined from trusted
 *   request metadata. It has no key and no counter; the policy's
 *   `onUnresolvedClient` decides (skip this limit, or deny).
 * - `global`: one bucket for the whole policy, for a deliberate shared cap.
 */
export type RateLimitSubject =
  | { readonly kind: 'actor'; readonly tenantId: string; readonly actorId: string }
  | { readonly kind: 'client'; readonly address: string }
  | { readonly kind: 'unresolved-client' }
  | { readonly kind: 'identifier'; readonly value: string }
  | { readonly kind: 'global' };

/** Longer than any email address (254) or IPv6 text form (45); anything beyond is not a real value. */
export const MAX_SUBJECT_PART_LENGTH = 320;

/** Separates fields inside the hashed material, so ("ab","c") and ("a","bc") cannot collide. */
const FIELD_SEPARATOR = '\u0000';

export type BucketKeyResult =
  | { readonly isValid: true; readonly key: string }
  | { readonly isValid: false; readonly problem: string };

function normalise(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

function materialFor(
  subject: Exclude<RateLimitSubject, { kind: 'global' | 'unresolved-client' }>,
): string[] {
  switch (subject.kind) {
    case 'actor':
      return [subject.tenantId, subject.actorId];
    case 'client':
      return [normalise(subject.address)];
    case 'identifier':
      return [normalise(subject.value)];
  }
}

/**
 * The storage key of one counter: `<policy id>:<kind>:<HMAC-SHA256 of the subject>`.
 *
 * - The policy id is readable so an operator can find or clear one policy's keys.
 * - The subject is hashed with a server secret, so the table holds no email, no
 *   IP address and no user id, and is useless for harvesting them.
 * - The kind is part of both the key and the hashed material, so an actor, a
 *   client and an identifier that happen to share text never share a counter.
 * - The key has a fixed length whatever the input, so a long value cannot bloat
 *   the table; values over `MAX_SUBJECT_PART_LENGTH` are refused instead.
 */
export function buildBucketKey(
  policyId: string,
  subject: RateLimitSubject,
  secret: string,
): BucketKeyResult {
  if (subject.kind === 'global') {
    return { isValid: true, key: `${policyId}:global` };
  }
  if (subject.kind === 'unresolved-client') {
    // Never counted: a shared counter for "everyone we could not identify" would let one
    // flood lock all of them out. The limiter applies `onUnresolvedClient` before this point.
    return { isValid: false, problem: 'an unresolved client has no counter' };
  }

  const parts = materialFor(subject);
  if (parts.some((part) => part.length === 0)) {
    return { isValid: false, problem: `${subject.kind} subject is empty` };
  }
  if (parts.some((part) => part.length > MAX_SUBJECT_PART_LENGTH)) {
    return { isValid: false, problem: `${subject.kind} subject is too long` };
  }

  const digest = createHmac('sha256', secret)
    .update([subject.kind, ...parts].join(FIELD_SEPARATOR))
    .digest('hex');
  return { isValid: true, key: `${policyId}:${subject.kind}:${digest}` };
}
