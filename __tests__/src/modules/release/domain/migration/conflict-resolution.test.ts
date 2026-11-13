import { describe, expect, it } from 'vitest';

import { RELEASE_VALIDATION_CODES as CODES } from '@modules/release/domain/errors/release-errors';
import {
  isAcceptableCustomValue,
  parseConflictResolutions,
  serializeConflictResolutions,
} from '@modules/release/domain/migration/conflict-resolution';
import type { MigrationPlan } from '@modules/release/domain/migration/migration-plan';

describe('conflict-resolution domain logic', () => {
  describe('isAcceptableCustomValue', () => {
    it('accepts primitive and plain object values within limits', () => {
      expect(isAcceptableCustomValue('valid string')).toBe(true);
      expect(isAcceptableCustomValue(12345)).toBe(true);
      expect(isAcceptableCustomValue(true)).toBe(true);
      expect(isAcceptableCustomValue({ a: 1, b: 'two' })).toBe(true);
      expect(isAcceptableCustomValue([1, 2, 3])).toBe(true);
    });

    it('rejects values with functions, symbols, or undefined', () => {
      expect(isAcceptableCustomValue(() => {})).toBe(false);
      expect(isAcceptableCustomValue(Symbol('sym'))).toBe(false);
      expect(isAcceptableCustomValue(undefined)).toBe(false);
    });

    it('rejects deeply nested values exceeding max depth', () => {
      let deep: any = 'leaf';
      for (let i = 0; i < 10; i++) {
        deep = { nested: deep };
      }
      expect(isAcceptableCustomValue(deep)).toBe(false);
    });
  });

  describe('parseConflictResolutions', () => {
    const samplePlan: MigrationPlan = {
      pages: [
        {
          path: '',
          nodes: [
            {
              nodeId: 'node-1',
              type: 'hero',
              status: 'needs_review',
              fromVersion: 1,
              toVersion: 2,
              mergedProps: { title: 'Local' },
              addedFields: [],
              conflicts: [
                {
                  kind: 'both_changed',
                  key: 'title',
                  base: 'Base',
                  local: 'Local',
                  incoming: 'Upstream',
                },
                {
                  kind: 'removed_upstream',
                  key: 'oldSetting',
                  base: 'BaseSetting',
                  local: 'CustomSetting',
                },
              ],
            },
          ],
        },
      ],
    };

    it('parses valid resolutions for all actions', () => {
      const input = {
        '': {
          'node-1': {
            title: { action: 'use_new' },
            oldSetting: { action: 'keep_local' },
          },
        },
      };

      const result = parseConflictResolutions(input, samplePlan);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value['']?.['node-1']).toEqual({
          title: { action: 'use_new' },
          oldSetting: { action: 'keep_local' },
        });

        const serialized = serializeConflictResolutions(result.value);
        expect(serialized).toEqual(result.value);
      }
    });

    it('accepts custom action with valid custom value for both_changed conflict', () => {
      const input = {
        '': {
          'node-1': {
            title: { action: 'custom', value: 'Hand-picked Title' },
            oldSetting: { action: 'use_new' },
          },
        },
      };

      const result = parseConflictResolutions(input, samplePlan);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value['']?.['node-1']?.['title']).toEqual({
          action: 'custom',
          value: 'Hand-picked Title',
        });
      }
    });

    it('rejects custom action for removed_upstream conflict', () => {
      const input = {
        '': {
          'node-1': {
            oldSetting: { action: 'custom', value: 'Attempted Custom' },
          },
        },
      };

      const result = parseConflictResolutions(input, samplePlan);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['resolutions.home.node-1.oldSetting']).toContain(
          CODES.resolutionActionInvalid,
        );
      }
    });

    it('rejects unknown page, node, or field not in plan', () => {
      const input = {
        'unknown-page': {
          'node-1': {
            title: { action: 'use_new' },
          },
        },
        '': {
          'unknown-node': {
            title: { action: 'use_new' },
          },
          'node-1': {
            'unknown-field': { action: 'use_new' },
          },
        },
      };

      const result = parseConflictResolutions(input, samplePlan);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['resolutions.unknown-page']).toContain(
          CODES.resolutionPageUnknown,
        );
        expect(result.error.fieldErrors['resolutions.home.unknown-node']).toContain(
          CODES.resolutionNodeUnknown,
        );
        expect(result.error.fieldErrors['resolutions.home.node-1.unknown-field']).toContain(
          CODES.resolutionFieldUnknown,
        );
      }
    });

    it('rejects invalid action or invalid custom value', () => {
      const input = {
        '': {
          'node-1': {
            title: { action: 'invalid_action' },
            oldSetting: { action: 'custom', value: () => {} },
          },
        },
      };

      const result = parseConflictResolutions(input, samplePlan);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['resolutions.home.node-1.title']).toContain(
          CODES.resolutionActionInvalid,
        );
      }
    });
  });
});
