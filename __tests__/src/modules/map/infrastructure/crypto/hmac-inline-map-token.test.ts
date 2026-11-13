import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { InlineMapDefinition } from '@modules/map/domain/ports/inline-map-token.port';
import { HmacInlineMapToken } from '@modules/map/infrastructure/crypto/hmac-inline-map-token';

import { DATASET_ID, OTHER_WEBSITE_ID, WEBSITE_ID, mapDraft } from '../../support/map-fakes';

const SECRET = 'a-map-signing-secret-with-at-least-32-characters';

function definition(mode: InlineMapDefinition['mode'] = 'published'): InlineMapDefinition {
  return { websiteId: WEBSITE_ID, mode, draft: mapDraft() };
}

function issue(tokens: HmacInlineMapToken, value = definition()): string {
  const result = tokens.issue(value);
  expect(result.isOk()).toBe(true);
  if (result.isErr()) {
    throw new Error('A valid token fixture must be issued.');
  }
  return result.value;
}

function replacePayload(token: string, value: unknown): string {
  const signature = token.slice(token.indexOf('.') + 1);
  return `${Buffer.from(JSON.stringify(value)).toString('base64url')}.${signature}`;
}

/** A genuine signature around invalid persisted input exercises decoding and domain validation independently of tamper detection. */
function signedPayload(value: string): string {
  const payload = Buffer.from(value).toString('base64url');
  const signature = createHmac('sha256', SECRET)
    .update(`civo.map.inline.v1\0${payload}`)
    .digest('base64url');
  return `${payload}.${signature}`;
}

describe('HmacInlineMapToken', () => {
  it.each(['published', 'draft'] as const)('round trips the exact %s map definition', (mode) => {
    const tokens = new HmacInlineMapToken(() => SECRET);
    const input = definition(mode);
    const decoded = tokens.read(issue(tokens, input));
    expect(decoded.isOk()).toBe(true);
    if (decoded.isOk()) {
      expect(decoded.value).toEqual(input);
    }
  });

  it.each([
    ['website', { ...definition(), websiteId: OTHER_WEBSITE_ID }],
    ['mode', { ...definition('draft'), mode: 'published' }],
    [
      'dataset',
      {
        ...definition(),
        draft: mapDraft({ layers: [{ datasetId: `${DATASET_ID}-another`, label: 'Buildings' }] }),
      },
    ],
  ] as const)('rejects an unsigned %s substitution', (_field, substituted) => {
    const tokens = new HmacInlineMapToken(() => SECRET);
    const original = issue(tokens, definition('draft'));
    const result = tokens.read(replacePayload(original, substituted));
    expect(result.isErr()).toBe(true);
  });

  it('rejects a changed signature', () => {
    const tokens = new HmacInlineMapToken(() => SECRET);
    const token = issue(tokens);
    const split = token.indexOf('.') + 1;
    const changed = `${token.slice(0, split)}${token[split] === 'A' ? 'B' : 'A'}${token.slice(split + 1)}`;
    expect(tokens.read(changed).isErr()).toBe(true);
  });

  it.each(['', 'not-a-token', 'payload.signature.extra', 'payload.', 'x'.repeat(24_001)])(
    'rejects malformed or oversized token input',
    (token) => {
      expect(new HmacInlineMapToken(() => SECRET).read(token).isErr()).toBe(true);
    },
  );

  it.each([
    'not JSON',
    JSON.stringify({}),
    JSON.stringify({ ...definition(), mode: 'unknown' }),
    JSON.stringify({ ...definition(), websiteId: '' }),
    JSON.stringify({ ...definition(), websiteId: 'x'.repeat(129) }),
    JSON.stringify({ ...definition(), draft: mapDraft({ featureLimit: -1 }) }),
    JSON.stringify({ ...definition(), draft: { ...mapDraft(), name: '' } }),
  ])('validates decoded content even when its signature is genuine', (payload) => {
    expect(new HmacInlineMapToken(() => SECRET).read(signedPayload(payload)).isErr()).toBe(true);
  });

  it.each([undefined, '', 'too-short'])(
    'fails closed when the signing secret is missing or too short',
    (secret) => {
      const valid = issue(new HmacInlineMapToken(() => SECRET));
      const tokens = new HmacInlineMapToken(() => secret);
      const issued = tokens.issue(definition());
      const decoded = tokens.read(valid);
      expect(issued.isErr()).toBe(true);
      expect(decoded.isErr()).toBe(true);
      if (issued.isErr()) {
        expect(issued.error.code).toBe('map.source_failed');
      }
      if (decoded.isErr()) {
        expect(decoded.error.code).toBe('map.source_failed');
      }
    },
  );

  it('rejects invalid definitions at issuance', () => {
    const tokens = new HmacInlineMapToken(() => SECRET);
    expect(tokens.issue({ ...definition(), draft: mapDraft({ layers: [] }) }).isErr()).toBe(true);
  });

  it('invalidates previously issued tokens after key rotation', () => {
    let secret = SECRET;
    const tokens = new HmacInlineMapToken(() => secret);
    const previous = issue(tokens);
    secret = 'a-new-map-signing-secret-with-at-least-32-characters';
    expect(tokens.read(previous).isErr()).toBe(true);
    expect(tokens.read(issue(tokens)).isOk()).toBe(true);
  });
});
