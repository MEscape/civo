import { describe, expect, it } from 'vitest';

import { COMPONENT_PLATFORM_VALIDATION_CODES as CODES } from '@modules/component-platform/domain/errors/component-platform-errors';
import {
  boolean,
  email,
  instant,
  instantKeys,
  list,
  mappedOneOf,
  number,
  object,
  oneOfValues,
  opaqueRecord,
  optionalField,
  parseRecord,
  parseShape,
  scalarMap,
  text,
  url,
  withDefault,
  withFallback,
} from '@modules/component-platform/domain/models/field-schema';

describe('field-schema domain validation engine', () => {
  describe('text and email schema', () => {
    it('validates required and length limits', () => {
      const schema = text({ min: 1, max: 10, trim: true });
      expect(schema.parse('  hello  ')).toEqual({ ok: true, value: 'hello' });
      expect(schema.parse('')).toEqual({
        ok: false,
        failures: [{ code: CODES.required, path: '' }],
      });
      expect(schema.parse('too long text string')).toEqual({
        ok: false,
        failures: [{ code: CODES.tooLong, path: '' }],
      });
      expect(schema.parse(123)).toEqual({
        ok: false,
        failures: [{ code: CODES.typeInvalid, path: '' }],
      });
    });

    it('validates min > 1 as tooShort', () => {
      const schema = text({ min: 5, max: 10 });
      expect(schema.parse('abc')).toEqual({
        ok: false,
        failures: [{ code: CODES.tooShort, path: '' }],
      });
    });

    it('validates regex patterns', () => {
      const schema = text({ max: 20, pattern: /^[A-Z]+$/ });
      expect(schema.parse('ABC')).toEqual({ ok: true, value: 'ABC' });
      expect(schema.parse('abc')).toEqual({
        ok: false,
        failures: [{ code: CODES.formatInvalid, path: '' }],
      });
    });

    it('validates email addresses', () => {
      const schema = email(50);
      expect(schema.parse('user@example.com')).toEqual({ ok: true, value: 'user@example.com' });
      expect(schema.parse('invalid-email')).toEqual({
        ok: false,
        failures: [{ code: CODES.formatInvalid, path: '' }],
      });
    });
  });

  describe('url schema', () => {
    it('validates absolute http(s) URLs', () => {
      const schema = url({ max: 100, allowRelative: false });
      expect(schema.parse('https://example.com/api')).toEqual({
        ok: true,
        value: 'https://example.com/api',
      });
      expect(schema.parse('/relative/path')).toEqual({
        ok: false,
        failures: [{ code: CODES.urlUnsafe, path: '' }],
      });
      expect(schema.parse('javascript:alert(1)')).toEqual({
        ok: false,
        failures: [{ code: CODES.urlUnsafe, path: '' }],
      });
    });

    it('validates relative URLs when allowed', () => {
      const schema = url({ max: 100, allowRelative: true });
      expect(schema.parse('/services/passport')).toEqual({
        ok: true,
        value: '/services/passport',
      });
    });
  });

  describe('instant schema', () => {
    it('validates ISO 8601 UTC with ms precision', () => {
      const schema = instant();
      expect(schema.isInstant).toBe(true);
      expect(schema.parse('2026-10-27T12:00:00.000Z')).toEqual({
        ok: true,
        value: '2026-10-27T12:00:00.000Z',
      });
      expect(schema.parse('2026-10-27T12:00:00Z')).toEqual({
        ok: false,
        failures: [{ code: CODES.instantInvalid, path: '' }],
      });
      expect(schema.parse('not-a-date')).toEqual({
        ok: false,
        failures: [{ code: CODES.instantInvalid, path: '' }],
      });
    });
  });

  describe('number and boolean schemas', () => {
    it('validates min, max, and integer constraints', () => {
      const schema = number({ min: 0, max: 100, integer: true });
      expect(schema.parse(50)).toEqual({ ok: true, value: 50 });
      expect(schema.parse(50.5)).toEqual({
        ok: false,
        failures: [{ code: CODES.typeInvalid, path: '' }],
      });
      expect(schema.parse(-1)).toEqual({
        ok: false,
        failures: [{ code: CODES.outOfRange, path: '' }],
      });
      expect(schema.parse(101)).toEqual({
        ok: false,
        failures: [{ code: CODES.outOfRange, path: '' }],
      });
      expect(schema.parse(Number.NaN)).toEqual({
        ok: false,
        failures: [{ code: CODES.typeInvalid, path: '' }],
      });
    });

    it('validates booleans', () => {
      const schema = boolean();
      expect(schema.parse(true)).toEqual({ ok: true, value: true });
      expect(schema.parse(false)).toEqual({ ok: true, value: false });
      expect(schema.parse('true')).toEqual({
        ok: false,
        failures: [{ code: CODES.typeInvalid, path: '' }],
      });
    });
  });

  describe('oneOfValues and mappedOneOf schemas', () => {
    it('validates oneOfValues options', () => {
      const schema = oneOfValues(['small', 'medium', 'large'] as const);
      expect(schema.parse('medium')).toEqual({ ok: true, value: 'medium' });
      expect(schema.parse('extra-large')).toEqual({
        ok: false,
        failures: [{ code: CODES.optionUnknown, path: '' }],
      });
    });

    it('normalizes aliases with mappedOneOf', () => {
      const schema = mappedOneOf(['high', 'medium', 'low'] as const, {
        urgent: 'high',
        normal: 'medium',
      });
      expect(schema.parse('high')).toEqual({ ok: true, value: 'high' });
      expect(schema.parse('  Urgent  ')).toEqual({ ok: true, value: 'high' });
      expect(schema.parse('normal')).toEqual({ ok: true, value: 'medium' });
      expect(schema.parse('unknown-val')).toEqual({
        ok: false,
        failures: [{ code: CODES.optionUnknown, path: '' }],
      });
      expect(schema.parse(123)).toEqual({
        ok: false,
        failures: [{ code: CODES.typeInvalid, path: '' }],
      });
    });
  });

  describe('list, opaqueRecord, and scalarMap', () => {
    it('validates lists and nested item errors with path', () => {
      const schema = list(number({ min: 0 }), 3);
      expect(schema.parse([1, 2, 3])).toEqual({ ok: true, value: [1, 2, 3] });
      expect(schema.parse([1, -5, 3])).toEqual({
        ok: false,
        failures: [{ code: CODES.outOfRange, path: '1' }],
      });
      expect(schema.parse([1, 2, 3, 4])).toEqual({
        ok: false,
        failures: [{ code: CODES.tooMany, path: '' }],
      });
    });

    it('validates opaqueRecord node limits', () => {
      const schema = opaqueRecord({ maxNodes: 5 });
      expect(schema.parse({ a: 1, b: { c: 2 } })).toEqual({
        ok: true,
        value: { a: 1, b: { c: 2 } },
      });
      expect(schema.parse({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 })).toEqual({
        ok: false,
        failures: [{ code: CODES.tooMany, path: '' }],
      });
    });

    it('filters invalid entries in scalarMap without failing whole record', () => {
      const schema = scalarMap({ maxEntries: 3, maxKeyLength: 10, maxTextLength: 20 });
      const raw = {
        validKey: 'valid text',
        numKey: 42,
        boolKey: true,
        nested: { bad: 'object' },
        __proto__: 'evil',
        tooLongKeyHere: 'val',
      };
      expect(schema.parse(raw)).toEqual({
        ok: true,
        value: {
          validKey: 'valid text',
          numKey: 42,
          boolKey: true,
        },
      });
    });
  });

  describe('modifiers and composition (optionalField, withDefault, withFallback, object, parseRecord)', () => {
    it('handles optionalField, withDefault, and withFallback', () => {
      const opt = optionalField(number());
      expect(opt.parse(null)).toEqual({ ok: true, value: undefined });
      expect(opt.parse(undefined)).toEqual({ ok: true, value: undefined });
      expect(opt.parse(5)).toEqual({ ok: true, value: 5 });

      const def = withDefault(text({ max: 10 }), 'default');
      expect(def.parse(null)).toEqual({ ok: true, value: 'default' });
      expect(def.parse('custom')).toEqual({ ok: true, value: 'custom' });

      const fb = withFallback(oneOfValues(['red', 'blue'] as const), 'blue');
      expect(fb.parse('green')).toEqual({ ok: true, value: 'blue' });
      expect(fb.parse('red')).toEqual({ ok: true, value: 'red' });
    });

    it('parses nested shapes and records', () => {
      const shape = {
        name: text({ min: 1, max: 50 }),
        age: optionalField(number({ min: 0 })),
        address: object({
          city: text({ min: 1, max: 50 }),
        }),
      };

      const outcome = parseShape(shape, {
        name: 'Alice',
        address: { city: 'Munich' },
      });
      expect(outcome.ok).toBe(true);

      const recordRes = parseRecord(shape, {
        name: '',
        address: { city: '' },
      });
      expect(recordRes.isErr()).toBe(true);
      if (recordRes.isErr()) {
        expect(recordRes.error.fieldErrors['name']).toBeDefined();
        expect(recordRes.error.fieldErrors['address.city']).toBeDefined();
      }
    });

    it('extracts instantKeys from shape', () => {
      const shape = {
        created: instant(),
        title: text({ max: 10 }),
        updated: instant(),
      };
      expect([...instantKeys(shape)].sort()).toEqual(['created', 'updated']);
    });
  });
});
