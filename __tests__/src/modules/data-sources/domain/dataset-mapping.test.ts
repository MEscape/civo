import { describe, expect, it } from 'vitest';

import {
  MAPPING_LIMITS,
  createDatasetMapping,
  ensureRequiredTargets,
  isValidSourcePath,
  restoreDatasetMapping,
} from '@modules/data-sources/domain/mapping/dataset-mapping';

describe('dataset-mapping domain logic', () => {
  describe('isValidSourcePath', () => {
    it('accepts valid paths', () => {
      expect(isValidSourcePath('title')).toBe(true);
      expect(isValidSourcePath('items.0.name')).toBe(true);
      expect(isValidSourcePath('user/address/city')).toBe(true);
    });

    it('rejects empty strings', () => {
      expect(isValidSourcePath('')).toBe(false);
    });

    it('rejects paths exceeding maximum length', () => {
      const longPath = 'a'.repeat(MAPPING_LIMITS.maxPathLength + 1);
      expect(isValidSourcePath(longPath)).toBe(false);
    });

    it('rejects unsafe path segments', () => {
      expect(isValidSourcePath('__proto__')).toBe(false);
      expect(isValidSourcePath('foo.__proto__.bar')).toBe(false);
      expect(isValidSourcePath('constructor')).toBe(false);
      expect(isValidSourcePath('prototype.foo')).toBe(false);
    });
  });

  describe('createDatasetMapping', () => {
    it('creates a valid mapping for an Event', () => {
      const result = createDatasetMapping('Event', {
        fields: [
          { sourcePath: 'raw_title', targetPath: 'title' },
          { sourcePath: 'raw_date', targetPath: 'startDate', transform: { kind: 'datetime' } },
          { sourcePath: 'opt_desc', targetPath: 'description', transform: { kind: 'string' } },
        ],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.fields).toHaveLength(3);
        expect(result.value.fields[0]).toEqual({
          sourcePath: 'raw_title',
          targetPath: 'title',
          required: true,
        });
        expect(result.value.fields[1]).toEqual({
          sourcePath: 'raw_date',
          targetPath: 'startDate',
          transform: { kind: 'datetime' },
          required: true,
        });
        expect(result.value.fields[2]?.required).toBe(false);
      }
    });

    it('rejects empty fields list or exceeding maxFields', () => {
      const emptyResult = createDatasetMapping('Event', { fields: [] });
      expect(emptyResult.isErr()).toBe(true);
      if (emptyResult.isErr()) {
        expect(emptyResult.error.fieldErrors['fields']).toContain(
          'dataset.mapping.field_count_invalid',
        );
      }

      const tooMany = Array.from({ length: MAPPING_LIMITS.maxFields + 1 }, (_, i) => ({
        sourcePath: `src_${i}`,
        targetPath: 'title',
      }));
      const tooManyResult = createDatasetMapping('Event', { fields: tooMany });
      expect(tooManyResult.isErr()).toBe(true);
      if (tooManyResult.isErr()) {
        expect(tooManyResult.error.fieldErrors['fields']).toContain(
          'dataset.mapping.field_count_invalid',
        );
      }
    });

    it('validates source and target paths', () => {
      const result = createDatasetMapping('Event', {
        fields: [
          { sourcePath: '__proto__.bad', targetPath: '123invalid' },
          { sourcePath: 'valid_src', targetPath: 'nonExistentTarget' },
          { sourcePath: 'valid_src2', targetPath: 'a.b.c.d.e.f' }, // exceeds maxTargetDepth of 5
        ],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['fields.0.sourcePath']).toContain(
          'dataset.mapping.source_path_invalid',
        );
        expect(result.error.fieldErrors['fields.0.targetPath']).toContain(
          'dataset.mapping.target_path_invalid',
        );
        expect(result.error.fieldErrors['fields.1.targetPath']).toContain(
          'dataset.mapping.target_path_unknown',
        );
        expect(result.error.fieldErrors['fields.2.targetPath']).toContain(
          'dataset.mapping.target_path_invalid',
        );
      }
    });

    it('detects target path conflicts', () => {
      const result = createDatasetMapping('Event', {
        fields: [
          { sourcePath: 'src1', targetPath: 'location' },
          { sourcePath: 'src2', targetPath: 'location.name' },
        ],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['fields.1.targetPath']).toContain(
          'dataset.mapping.target_path_conflict',
        );
      }

      const exactDuplicate = createDatasetMapping('Event', {
        fields: [
          { sourcePath: 'src1', targetPath: 'title' },
          { sourcePath: 'src2', targetPath: 'title' },
        ],
      });
      expect(exactDuplicate.isErr()).toBe(true);
      if (exactDuplicate.isErr()) {
        expect(exactDuplicate.error.fieldErrors['fields.1.targetPath']).toContain(
          'dataset.mapping.target_path_conflict',
        );
      }
    });

    it('normalizes join transforms correctly and rejects invalid joins', () => {
      const validJoin = createDatasetMapping('Contact', {
        fields: [
          {
            sourcePath: 'first_name',
            targetPath: 'name',
            transform: { kind: 'join', sourcePaths: ['first_name', 'last_name'], separator: ' ' },
          },
        ],
      });
      expect(validJoin.isOk()).toBe(true);
      if (validJoin.isOk()) {
        expect(validJoin.value.fields[0]?.transform).toEqual({
          kind: 'join',
          sourcePaths: ['first_name', 'last_name'],
          separator: ' ',
        });
      }

      const invalidJoin = createDatasetMapping('Contact', {
        fields: [
          {
            sourcePath: 'name',
            targetPath: 'name',
            transform: { kind: 'join', sourcePaths: [], separator: ' ' },
          },
          {
            sourcePath: 'role',
            targetPath: 'role',
            transform: {
              kind: 'join',
              sourcePaths: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], // 7 sources > maxJoinSources 6
            },
          },
          {
            sourcePath: 'email',
            targetPath: 'email',
            transform: {
              kind: 'join',
              sourcePaths: ['__proto__'],
            },
          },
          {
            sourcePath: 'phone',
            targetPath: 'phone',
            transform: {
              kind: 'join',
              sourcePaths: ['p1'],
              separator: 'x'.repeat(MAPPING_LIMITS.maxSeparatorLength + 1),
            },
          },
        ],
      });

      expect(invalidJoin.isErr()).toBe(true);
      if (invalidJoin.isErr()) {
        expect(invalidJoin.error.fieldErrors['fields.0.transform']).toContain(
          'dataset.mapping.transform_invalid',
        );
        expect(invalidJoin.error.fieldErrors['fields.1.transform']).toContain(
          'dataset.mapping.transform_invalid',
        );
        expect(invalidJoin.error.fieldErrors['fields.2.transform']).toContain(
          'dataset.mapping.transform_invalid',
        );
        expect(invalidJoin.error.fieldErrors['fields.3.transform']).toContain(
          'dataset.mapping.transform_invalid',
        );
      }
    });

    it('normalizes fallback transforms correctly and rejects invalid values', () => {
      const validFallback = createDatasetMapping('Contact', {
        fields: [
          {
            sourcePath: 'raw_name',
            targetPath: 'name',
            transform: { kind: 'fallback', value: 'Anonymous' },
          },
          {
            sourcePath: 'raw_role',
            targetPath: 'role',
            transform: { kind: 'fallback', value: 42 },
          },
        ],
      });
      expect(validFallback.isOk()).toBe(true);

      const invalidFallback = createDatasetMapping('Contact', {
        fields: [
          {
            sourcePath: 'raw_name',
            targetPath: 'name',
            transform: { kind: 'fallback', value: Number.NaN },
          },
        ],
      });
      expect(invalidFallback.isErr()).toBe(true);
      if (invalidFallback.isErr()) {
        expect(invalidFallback.error.fieldErrors['fields.0.transform']).toContain(
          'dataset.mapping.transform_invalid',
        );
      }
    });

    it('supports all simple transform kinds', () => {
      const kinds = ['string', 'number', 'boolean', 'url', 'date', 'datetime'] as const;
      for (const kind of kinds) {
        const res = createDatasetMapping('Alert', {
          fields: [
            { sourcePath: 'title', targetPath: 'title', transform: { kind } },
            { sourcePath: 'sev', targetPath: 'severity' },
            { sourcePath: 'act', targetPath: 'active' },
          ],
        });
        expect(res.isOk()).toBe(true);
        if (res.isOk()) {
          expect(res.value.fields[0]?.transform).toEqual({ kind });
        }
      }
    });
  });

  describe('ensureRequiredTargets', () => {
    it('succeeds when all required fields are present', () => {
      const mapping = createDatasetMapping('Event', {
        fields: [
          { sourcePath: 'title', targetPath: 'title' },
          { sourcePath: 'startDate', targetPath: 'startDate' },
        ],
      })._unsafeUnwrap();

      const result = ensureRequiredTargets('Event', mapping);
      expect(result.isOk()).toBe(true);
    });

    it('fails when a required field is missing', () => {
      const mapping = createDatasetMapping('Event', {
        fields: [{ sourcePath: 'title', targetPath: 'title' }],
      })._unsafeUnwrap();

      const result = ensureRequiredTargets('Event', mapping);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['startDate']).toContain(
          'dataset.mapping.required_target_missing',
        );
      }
    });
  });

  describe('restoreDatasetMapping', () => {
    it('restores a valid stored mapping', () => {
      const stored = {
        fields: [
          { sourcePath: 'raw_title', targetPath: 'title' },
          {
            sourcePath: 'raw_start',
            targetPath: 'startDate',
            transform: { kind: 'datetime' },
          },
          {
            sourcePath: 'desc',
            targetPath: 'description',
            transform: { kind: 'join', sourcePaths: ['a', 'b'], separator: ' - ' },
          },
          {
            sourcePath: 'loc',
            targetPath: 'location',
            transform: { kind: 'fallback', value: 'City Hall' },
          },
        ],
      };

      const restored = restoreDatasetMapping('Event', stored);
      expect(restored).not.toBeNull();
      expect(restored?.fields).toHaveLength(4);
      expect(restored?.fields[0]?.required).toBe(true);
      expect(restored?.fields[2]?.transform).toEqual({
        kind: 'join',
        sourcePaths: ['a', 'b'],
        separator: ' - ',
      });
      expect(restored?.fields[3]?.transform).toEqual({
        kind: 'fallback',
        value: 'City Hall',
      });
    });

    it('returns null for non-object, missing fields, or too many fields', () => {
      expect(restoreDatasetMapping('Event', null)).toBeNull();
      expect(restoreDatasetMapping('Event', 'string')).toBeNull();
      expect(restoreDatasetMapping('Event', { fields: 'not-array' })).toBeNull();
      expect(
        restoreDatasetMapping('Event', {
          fields: Array.from({ length: 51 }, () => ({ sourcePath: 'a', targetPath: 'title' })),
        }),
      ).toBeNull();
    });

    it('returns null for malformed fields or unknown transforms', () => {
      expect(
        restoreDatasetMapping('Event', {
          fields: [{ sourcePath: 123, targetPath: 'title' }],
        }),
      ).toBeNull();

      expect(
        restoreDatasetMapping('Event', {
          fields: [{ sourcePath: 'title', targetPath: 'title', transform: 'invalid' }],
        }),
      ).toBeNull();

      expect(
        restoreDatasetMapping('Event', {
          fields: [
            { sourcePath: 'title', targetPath: 'title', transform: { kind: 'unknown_kind' } },
          ],
        }),
      ).toBeNull();

      expect(
        restoreDatasetMapping('Event', {
          fields: [
            {
              sourcePath: 'title',
              targetPath: 'title',
              transform: { kind: 'fallback', value: {} },
            },
          ],
        }),
      ).toBeNull();

      expect(
        restoreDatasetMapping('Event', {
          fields: [
            {
              sourcePath: 'title',
              targetPath: 'title',
              transform: { kind: 'join', sourcePaths: 'not-array' },
            },
          ],
        }),
      ).toBeNull();
    });

    it('returns null if restored mapping violates domain invariants', () => {
      // E.g. target path conflict or invalid target path
      expect(
        restoreDatasetMapping('Event', {
          fields: [
            { sourcePath: 'a', targetPath: 'title' },
            { sourcePath: 'b', targetPath: 'title' },
          ],
        }),
      ).toBeNull();
    });
  });
});
