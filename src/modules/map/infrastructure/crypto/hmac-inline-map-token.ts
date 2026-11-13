import { createHmac, timingSafeEqual } from 'node:crypto';

import { err, fromThrowable, ok } from '@lib/result';
import { isPlainObject } from '@lib/utils';

import { mapInvalidInput, mapSourceFailed } from '../../domain/errors/map-errors';
import { parseWebsiteId } from '../../domain/models/ids';
import { createSavedMapDraft, isSavedMapSettings } from '../../domain/models/saved-map';
import { MAX_INLINE_MAP_TOKEN_LENGTH } from '../../domain/ports/inline-map-token.port';

import type { InlineMapDefinition, InlineMapToken } from '../../domain/ports/inline-map-token.port';

const MIN_SECRET_LENGTH = 32;
const PURPOSE = 'civo.map.inline.v1\0';
const DIGEST_LENGTH = 32;
const MODES = ['draft', 'published'] as const;

function definitionOf(value: unknown) {
  if (!isPlainObject(value) || typeof value['websiteId'] !== 'string') {
    return err(mapInvalidInput());
  }
  const mode = MODES.find((candidate) => candidate === value['mode']);
  const draft = value['draft'];
  if (mode === undefined || !isPlainObject(draft)) {
    return err(mapInvalidInput());
  }
  const { name, description, settings } = draft;
  if (
    typeof name !== 'string' ||
    (description !== null && typeof description !== 'string') ||
    !isSavedMapSettings(settings)
  ) {
    return err(mapInvalidInput());
  }
  return parseWebsiteId(value['websiteId']).andThen((websiteId) =>
    createSavedMapDraft({ name, description, settings }).map((parsed) => ({
      websiteId,
      mode,
      draft: parsed,
    })),
  );
}

/**
 * Purpose-bound signatures authorize exactly a page's immutable inline configuration, not arbitrary datasets.
 * Tokens have no expiry because published page snapshots may be cached indefinitely. Rotating the signing secret revokes them.
 * Draft tokens still require website authorization every time; signing one never makes preview data public.
 */
export class HmacInlineMapToken implements InlineMapToken {
  constructor(private readonly secret: () => string | undefined) {}

  issue(definition: InlineMapDefinition) {
    const secret = this.secret();
    if (secret === undefined || secret.length < MIN_SECRET_LENGTH) {
      return err(mapSourceFailed());
    }
    return definitionOf(definition).andThen((parsed) => {
      const payload = Buffer.from(JSON.stringify(parsed)).toString('base64url');
      const signature = createHmac('sha256', secret)
        .update(PURPOSE + payload)
        .digest('base64url');
      const token = `${payload}.${signature}`;
      return token.length <= MAX_INLINE_MAP_TOKEN_LENGTH ? ok(token) : err(mapInvalidInput());
    });
  }

  read(token: string) {
    const secret = this.secret();
    if (secret === undefined || secret.length < MIN_SECRET_LENGTH) {
      return err(mapSourceFailed());
    }
    if (token.length > MAX_INLINE_MAP_TOKEN_LENGTH) {
      return err(mapInvalidInput());
    }
    const [payload, signature, extra] = token.split('.');
    if (payload === undefined || signature === undefined || extra !== undefined) {
      return err(mapInvalidInput());
    }
    const received = Buffer.from(signature, 'base64url');
    const expected = createHmac('sha256', secret)
      .update(PURPOSE + payload)
      .digest();
    if (received.length !== DIGEST_LENGTH || !timingSafeEqual(received, expected)) {
      return err(mapInvalidInput());
    }
    return fromThrowable(
      (): unknown => JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
      mapInvalidInput,
    ).andThen(definitionOf);
  }
}
