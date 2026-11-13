import { describe, expect, it } from 'vitest';

import {
  BOOKING_ERROR_CODES,
  BOOKING_VALIDATION_CODES,
} from '@modules/booking/application/contracts/booking-constraints';
import deBooking from '@modules/booking/presentation/i18n/de.json';
import enBooking from '@modules/booking/presentation/i18n/en.json';
import {
  GENERIC_ERROR_MESSAGE_KEY,
  STATUS_MESSAGE_KEYS,
  messageKeyForCode,
} from '@modules/booking/presentation/messages/message-keys';

/** The text a dotted key names in a catalog, or `undefined` when the key leads nowhere. */
function textOf(catalog: { booking: unknown }, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      catalog.booking,
    );
}

const CODES = [...Object.values(BOOKING_ERROR_CODES), ...Object.values(BOOKING_VALIDATION_CODES)];

describe('message keys of the booking codes', () => {
  it.each(CODES)('maps %s to a text in German and in English', (code) => {
    const key = messageKeyForCode(code);

    for (const catalog of [deBooking, enBooking]) {
      const text = textOf(catalog, key);
      expect(typeof text === 'string' && text.length > 0).toBe(true);
    }
  });

  it('gives a code of another module the generic message, never a blank', () => {
    expect(messageKeyForCode('auth.forbidden')).toBe(GENERIC_ERROR_MESSAGE_KEY);
    expect(messageKeyForCode('')).toBe(GENERIC_ERROR_MESSAGE_KEY);
    expect(textOf(enBooking, GENERIC_ERROR_MESSAGE_KEY)).toBeTypeOf('string');
  });

  it('does not treat a property of Object as a code', () => {
    expect(messageKeyForCode('toString')).toBe(GENERIC_ERROR_MESSAGE_KEY);
  });

  it('has a word for every state a booking is drawn in', () => {
    for (const key of Object.values(STATUS_MESSAGE_KEYS)) {
      expect(textOf(deBooking, key)).toBeTypeOf('string');
      expect(textOf(enBooking, key)).toBeTypeOf('string');
    }
  });
});
