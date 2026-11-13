import { describe, expect, it } from 'vitest';

import { applyMapping } from '@modules/data-sources/domain/mapping/apply-mapping';
import type { DatasetMapping } from '@modules/data-sources/domain/mapping/dataset-mapping';

describe('applyMapping domain logic', () => {
  it('maps raw fields into target paths and nested objects', () => {
    const mapping: DatasetMapping = {
      fields: [
        { sourcePath: 'headline', targetPath: 'title', required: true },
        { sourcePath: 'details.summary', targetPath: 'description', required: false },
        {
          sourcePath: 'coords.lat',
          targetPath: 'location.lat',
          required: false,
          transform: { kind: 'number' },
        },
        {
          sourcePath: 'coords.lng',
          targetPath: 'location.lng',
          required: false,
          transform: { kind: 'number' },
        },
      ],
    };

    const record = {
      headline: 'Summer Festival',
      details: { summary: 'Annual celebration' },
      coords: { lat: '52.5200', lng: 13.405 },
    };

    const result = applyMapping(mapping, record);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        title: 'Summer Festival',
        description: 'Annual celebration',
        location: {
          lat: 52.52,
          lng: 13.405,
        },
      });
    }
  });

  describe('transforms', () => {
    describe('string transform', () => {
      const mapping: DatasetMapping = {
        fields: [
          { sourcePath: 'val', targetPath: 'str', required: false, transform: { kind: 'string' } },
        ],
      };

      it('converts numbers, booleans, and strings to text', () => {
        expect(applyMapping(mapping, { val: 12345 })._unsafeUnwrap()).toEqual({ str: '12345' });
        expect(applyMapping(mapping, { val: true })._unsafeUnwrap()).toEqual({ str: 'true' });
        expect(applyMapping(mapping, { val: 'hello' })._unsafeUnwrap()).toEqual({ str: 'hello' });
      });

      it('ignores undefined/null without error', () => {
        expect(applyMapping(mapping, { val: null })._unsafeUnwrap()).toEqual({});
        expect(applyMapping(mapping, {})._unsafeUnwrap()).toEqual({});
      });

      it('fails when value is an object or array', () => {
        const res = applyMapping(mapping, { val: { nested: 'obj' } });
        expect(res.isErr()).toBe(true);
        if (res.isErr()) {
          expect(res.error.fieldErrors['str']).toContain('dataset.mapping.value_not_text');
        }
      });
    });

    describe('number transform', () => {
      const mapping: DatasetMapping = {
        fields: [
          { sourcePath: 'val', targetPath: 'num', required: false, transform: { kind: 'number' } },
        ],
      };

      it('parses valid numbers and numeric strings', () => {
        expect(applyMapping(mapping, { val: 42 })._unsafeUnwrap()).toEqual({ num: 42 });
        expect(applyMapping(mapping, { val: ' 100.5 ' })._unsafeUnwrap()).toEqual({ num: 100.5 });
      });

      it('handles blank values as undefined', () => {
        expect(applyMapping(mapping, { val: '' })._unsafeUnwrap()).toEqual({});
        expect(applyMapping(mapping, { val: '   ' })._unsafeUnwrap()).toEqual({});
        expect(applyMapping(mapping, { val: null })._unsafeUnwrap()).toEqual({});
      });

      it('fails for invalid number strings or non-numeric types', () => {
        const res = applyMapping(mapping, { val: 'not-a-number' });
        expect(res.isErr()).toBe(true);
        if (res.isErr()) {
          expect(res.error.fieldErrors['num']).toContain('dataset.mapping.value_not_number');
        }
      });
    });

    describe('boolean transform', () => {
      const mapping: DatasetMapping = {
        fields: [
          {
            sourcePath: 'val',
            targetPath: 'bool',
            required: false,
            transform: { kind: 'boolean' },
          },
        ],
      };

      it('parses boolean values and boolean strings', () => {
        expect(applyMapping(mapping, { val: true })._unsafeUnwrap()).toEqual({ bool: true });
        expect(applyMapping(mapping, { val: false })._unsafeUnwrap()).toEqual({ bool: false });
        expect(applyMapping(mapping, { val: 'true' })._unsafeUnwrap()).toEqual({ bool: true });
        expect(applyMapping(mapping, { val: 'false' })._unsafeUnwrap()).toEqual({ bool: false });
      });

      it('handles null/undefined as blank', () => {
        expect(applyMapping(mapping, { val: null })._unsafeUnwrap()).toEqual({});
        expect(applyMapping(mapping, {})._unsafeUnwrap()).toEqual({});
      });

      it('fails for non-boolean values', () => {
        const res = applyMapping(mapping, { val: 'yes' });
        expect(res.isErr()).toBe(true);
        if (res.isErr()) {
          expect(res.error.fieldErrors['bool']).toContain('dataset.mapping.value_not_boolean');
        }
      });
    });

    describe('date transform', () => {
      const mapping: DatasetMapping = {
        fields: [
          { sourcePath: 'val', targetPath: 'dt', required: false, transform: { kind: 'date' } },
        ],
      };

      it('parses ISO dates, timestamps, and Date instances', () => {
        const date = new Date('2026-05-01T12:00:00Z');
        expect(applyMapping(mapping, { val: date })._unsafeUnwrap()).toEqual({ dt: date });
        expect(applyMapping(mapping, { val: 1714564800000 })._unsafeUnwrap()).toEqual({
          dt: new Date(1714564800000),
        });
      });

      it('handles blank values as undefined', () => {
        expect(applyMapping(mapping, { val: null })._unsafeUnwrap()).toEqual({});
        expect(applyMapping(mapping, { val: '' })._unsafeUnwrap()).toEqual({});
      });

      it('fails for unparseable dates', () => {
        const res = applyMapping(mapping, { val: 'invalid-date' });
        expect(res.isErr()).toBe(true);
        if (res.isErr()) {
          expect(res.error.fieldErrors['dt']).toContain('dataset.mapping.value_not_date');
        }
      });
    });

    describe('url transform', () => {
      const mapping: DatasetMapping = {
        fields: [
          { sourcePath: 'val', targetPath: 'link', required: false, transform: { kind: 'url' } },
        ],
      };

      it('validates and normalizes HTTP/HTTPS urls', () => {
        expect(
          applyMapping(mapping, { val: 'https://example.com/page?query=1' })._unsafeUnwrap(),
        ).toEqual({
          link: 'https://example.com/page?query=1',
        });
        expect(applyMapping(mapping, { val: 'http://example.org' })._unsafeUnwrap()).toEqual({
          link: 'http://example.org/',
        });
      });

      it('handles blank values as undefined', () => {
        expect(applyMapping(mapping, { val: null })._unsafeUnwrap()).toEqual({});
        expect(applyMapping(mapping, { val: '  ' })._unsafeUnwrap()).toEqual({});
      });

      it('fails for invalid URLs or forbidden protocols', () => {
        expect(applyMapping(mapping, { val: 'not a url' }).isErr()).toBe(true);
        expect(applyMapping(mapping, { val: 'javascript:alert(1)' }).isErr()).toBe(true);
        expect(applyMapping(mapping, { val: 'ftp://files.example.com' }).isErr()).toBe(true);
      });
    });

    describe('join transform', () => {
      const mapping: DatasetMapping = {
        fields: [
          {
            sourcePath: 'ignored',
            targetPath: 'fullName',
            required: false,
            transform: { kind: 'join', sourcePaths: ['prefix', 'first', 'last'], separator: ' ' },
          },
        ],
      };

      it('joins non-blank values with separator', () => {
        expect(
          applyMapping(mapping, { prefix: 'Dr.', first: 'Jane', last: 'Doe' })._unsafeUnwrap(),
        ).toEqual({
          fullName: 'Dr. Jane Doe',
        });

        // Filters blank parts
        expect(
          applyMapping(mapping, { prefix: null, first: 'Jane', last: 'Doe' })._unsafeUnwrap(),
        ).toEqual({
          fullName: 'Jane Doe',
        });
      });

      it('returns undefined if all sources are blank', () => {
        expect(
          applyMapping(mapping, { prefix: null, first: '', last: undefined })._unsafeUnwrap(),
        ).toEqual({});
      });
    });

    describe('fallback transform', () => {
      const mapping: DatasetMapping = {
        fields: [
          {
            sourcePath: 'val',
            targetPath: 'cat',
            required: false,
            transform: { kind: 'fallback', value: 'DefaultCategory' },
          },
        ],
      };

      it('returns raw value if present', () => {
        expect(applyMapping(mapping, { val: 'Special' })._unsafeUnwrap()).toEqual({
          cat: 'Special',
        });
      });

      it('returns fallback value if blank', () => {
        expect(applyMapping(mapping, { val: null })._unsafeUnwrap()).toEqual({
          cat: 'DefaultCategory',
        });
        expect(applyMapping(mapping, { val: '' })._unsafeUnwrap()).toEqual({
          cat: 'DefaultCategory',
        });
        expect(applyMapping(mapping, {})._unsafeUnwrap()).toEqual({
          cat: 'DefaultCategory',
        });
      });
    });
  });

  describe('validation errors and required fields', () => {
    it('fails when a required field produces a blank value', () => {
      const mapping: DatasetMapping = {
        fields: [
          { sourcePath: 'title', targetPath: 'title', required: true },
          { sourcePath: 'opt', targetPath: 'optional', required: false },
        ],
      };

      const result = applyMapping(mapping, { opt: 'present' });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['title']).toContain('dataset.mapping.value_missing');
      }
    });

    it('collects multiple field failures at once', () => {
      const mapping: DatasetMapping = {
        fields: [
          { sourcePath: 'num', targetPath: 'count', required: true, transform: { kind: 'number' } },
          { sourcePath: 'url', targetPath: 'link', required: true, transform: { kind: 'url' } },
        ],
      };

      const result = applyMapping(mapping, { num: 'not-num', url: 'not-url' });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['count']).toContain('dataset.mapping.value_not_number');
        expect(result.error.fieldErrors['link']).toContain('dataset.mapping.value_not_url');
      }
    });
  });
});
