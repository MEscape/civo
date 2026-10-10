import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BOOKING_ERROR_CODES,
  BOOKING_VALIDATION_CODES,
} from '@modules/booking/application/contracts/booking-constraints';
import { FLOW_STEPS } from '@modules/booking/presentation/flow/flow-state';
import deBooking from '@modules/booking/presentation/i18n/de.json';
import enBooking from '@modules/booking/presentation/i18n/en.json';
import {
  CHANGE_ACTOR_MESSAGE_KEYS,
  EXCEPTION_KIND_MESSAGE_KEYS,
  GENERIC_ERROR_MESSAGE_KEY,
  INFORMATION_FIELD_MESSAGE_KEYS,
  MESSAGE_KEY_BY_CODE,
  RESOURCE_TYPE_MESSAGE_KEYS,
  STATUS_MESSAGE_KEYS,
  WEEKDAY_MESSAGE_KEYS,
  messageKeyForCode,
} from '@modules/booking/presentation/messages/message-keys';

interface Catalog {
  readonly [key: string]: string | Catalog;
}

function lookup(catalog: Catalog, path: string): string | undefined {
  let node: string | Catalog | undefined = catalog;
  for (const part of path.split('.')) {
    if (typeof node !== 'object') {
      return undefined;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const LOCALES = { en: enBooking.booking as Catalog, de: deBooking.booking as Catalog };

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe.each(Object.entries(LOCALES))('booking messages (%s)', (_locale, catalog) => {
  it('has a message for every error and validation code', () => {
    const missing = Object.entries(MESSAGE_KEY_BY_CODE)
      .filter(([, key]) => !lookup(catalog, key))
      .map(([code, key]) => `${code} -> ${key}`);
    expect(missing).toEqual([]);
  });

  it('has a message for every status, resource type, field, weekday, exception kind and actor', () => {
    const maps = [
      STATUS_MESSAGE_KEYS,
      RESOURCE_TYPE_MESSAGE_KEYS,
      INFORMATION_FIELD_MESSAGE_KEYS,
      WEEKDAY_MESSAGE_KEYS,
      EXCEPTION_KIND_MESSAGE_KEYS,
      CHANGE_ACTOR_MESSAGE_KEYS,
    ];
    const missing = maps.flatMap((map) =>
      Object.values(map).filter((key) => !lookup(catalog, key)),
    );
    expect(missing).toEqual([]);
  });

  it('has a message for every step, time of day and placeholder state built from a variable', () => {
    const keys = [
      ...FLOW_STEPS.map((step) => `steps.${step}`),
      ...['morning', 'afternoon', 'evening'].map((part) => `time.parts.${part}`),
      ...['empty', 'empty-draft', 'unavailable', 'staff-only', 'no-access'].map(
        (kind) => `state.${kind}`,
      ),
      ...['customer', 'staff'].map((actor) => `actors.${actor}`),
    ];
    expect(keys.filter((key) => !lookup(catalog, key))).toEqual([]);
  });

  it('has every message the components write out literally', () => {
    const root = join(process.cwd(), 'src/modules/booking/presentation');
    const used = new Set<string>();
    for (const file of sourceFiles(join(root, 'components'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) {
        if (match[1] !== undefined) {
          used.add(match[1]);
        }
      }
    }
    expect(used.size).toBeGreaterThan(100);
    expect([...used].filter((key) => !lookup(catalog, key))).toEqual([]);
  });
});

describe('message keys for codes', () => {
  it('maps an unknown code to the generic message instead of showing a raw code', () => {
    expect(messageKeyForCode('something.new')).toBe(GENERIC_ERROR_MESSAGE_KEY);
  });

  it('maps the sign-in and permission codes of the auth module', () => {
    expect(messageKeyForCode('auth.unauthenticated')).toBe('errors.signInRequired');
    expect(messageKeyForCode('auth.session_expired')).toBe('errors.signInRequired');
    expect(messageKeyForCode('auth.permission_denied')).toBe('errors.permissionDenied');
  });

  it('covers every code the module can produce', () => {
    const codes = [
      ...Object.values(BOOKING_ERROR_CODES),
      ...Object.values(BOOKING_VALIDATION_CODES),
    ];
    for (const code of codes) {
      expect(Object.hasOwn(MESSAGE_KEY_BY_CODE, code), code).toBe(true);
    }
  });

  it('tells a visitor to wait when they are rate limited', () => {
    expect(messageKeyForCode(BOOKING_ERROR_CODES.rateLimited)).toBe('errors.rateLimited');
  });
});
