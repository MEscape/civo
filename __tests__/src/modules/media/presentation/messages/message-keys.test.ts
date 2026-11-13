import { describe, expect, it } from 'vitest';

import deMedia from '@modules/media/presentation/i18n/de.json';
import enMedia from '@modules/media/presentation/i18n/en.json';
import {
  MESSAGE_KEY_BY_CODE,
  TRANSFER_FAILED_CODE,
  messageKeyForCode,
  messageKeyForError,
} from '@modules/media/presentation/messages/message-keys';

describe('messages', () => {
  const lookup = (catalog: typeof enMedia, key: string) =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        catalog.media,
      );

  it('has a translation, in both languages, for every code the module can return', () => {
    const keys = [
      ...Object.values(MESSAGE_KEY_BY_CODE),
      messageKeyForCode('anything.unknown'),
      messageKeyForCode(TRANSFER_FAILED_CODE),
    ];
    for (const key of keys) {
      expect(typeof lookup(enMedia, key), `en ${key}`).toBe('string');
      expect(typeof lookup(deMedia, key), `de ${key}`).toBe('string');
    }
  });

  it('keeps the two languages in step', () => {
    const shape = (node: unknown): unknown =>
      node && typeof node === 'object'
        ? Object.fromEntries(Object.entries(node).map(([k, v]) => [k, shape(v)]))
        : 'text';
    expect(shape(deMedia)).toEqual(shape(enMedia));
  });

  it('answers a code from another module with the generic message', () => {
    expect(messageKeyForCode('auth.permission_denied')).toBe('errors.unexpected');
  });

  it('prefers the most specific field error of a failed action', () => {
    expect(
      messageKeyForError({
        code: 'media.validation_failed',
        message: 'x',
        fieldErrors: { byteSize: ['media.validation.size_too_large'] },
      }),
    ).toBe('validation.sizeTooLarge');
    expect(messageKeyForError({ code: 'media.in_use', message: 'x' })).toBe('errors.inUse');
  });
});
