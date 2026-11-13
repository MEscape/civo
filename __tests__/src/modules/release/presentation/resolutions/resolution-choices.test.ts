import { describe, expect, it } from 'vitest';

import type { MigrationPlanView } from '@modules/release/application/contracts/migration-views';
import {
  conflictKey,
  countUnresolvedNodes,
  hasInvalidChoice,
  parseCustomValue,
  toResolutionsInput,
} from '@modules/release/presentation/resolutions/resolution-choices';
import type { ChoiceMap } from '@modules/release/presentation/resolutions/resolution-choices';

describe('resolution-choices presentation helper', () => {
  describe('conflictKey', () => {
    it('serializes path, nodeId, and key as JSON array', () => {
      const key = conflictKey('/about', 'hero-1', 'title');
      expect(key).toBe(JSON.stringify(['/about', 'hero-1', 'title']));
    });
  });

  describe('parseCustomValue', () => {
    it('returns valid for acceptable JSON scalars and arrays/objects', () => {
      expect(parseCustomValue('"hello"')).toEqual({ isValid: true, value: 'hello' });
      expect(parseCustomValue('123')).toEqual({ isValid: true, value: 123 });
      expect(parseCustomValue('true')).toEqual({ isValid: true, value: true });
      expect(parseCustomValue('null')).toEqual({ isValid: true, value: null });
      expect(parseCustomValue('{"a":1}')).toEqual({ isValid: true, value: { a: 1 } });
    });

    it('returns invalid for malformed JSON or rejected values', () => {
      expect(parseCustomValue('not json')).toEqual({ isValid: false });
      expect(parseCustomValue('{unquoted: 1}')).toEqual({ isValid: false });
    });
  });

  describe('hasInvalidChoice', () => {
    it('returns false when no custom choices exist or all are valid', () => {
      const choices: ChoiceMap = {
        k1: { action: 'keep_local' },
        k2: { action: 'use_new' },
        k3: { action: 'custom', text: '"valid string"' },
      };
      expect(hasInvalidChoice(choices)).toBe(false);
    });

    it('returns true when at least one custom choice has invalid JSON', () => {
      const choices: ChoiceMap = {
        k1: { action: 'keep_local' },
        k2: { action: 'custom', text: 'broken json{' },
      };
      expect(hasInvalidChoice(choices)).toBe(true);
    });
  });

  describe('countUnresolvedNodes & toResolutionsInput', () => {
    const plan: MigrationPlanView = {
      pages: [
        {
          path: '/home',
          nodes: [
            {
              nodeId: 'node-1',
              type: 'hero',
              status: 'needs_review',
              fromVersion: 1,
              toVersion: 2,
              mergedProps: {},
              addedFields: [],
              conflicts: [
                {
                  kind: 'both_changed' as const,
                  key: 'title',
                  base: 'Old',
                  local: 'My Title',
                  incoming: 'New Title',
                },
                {
                  kind: 'both_changed' as const,
                  key: 'subtitle',
                  base: 'Sub',
                  local: 'My Sub',
                  incoming: 'New Sub',
                },
              ],
            },
            {
              nodeId: 'node-2',
              type: 'button',
              status: 'upgradable',
              fromVersion: 1,
              toVersion: 2,
              mergedProps: {},
              addedFields: [],
            },
          ],
        },
        {
          path: '/contact',
          nodes: [
            {
              nodeId: 'node-3',
              type: 'form',
              status: 'needs_review',
              fromVersion: 1,
              toVersion: 2,
              mergedProps: {},
              addedFields: [],
              conflicts: [
                {
                  kind: 'both_changed' as const,
                  key: 'email',
                  base: 'a',
                  local: 'b',
                  incoming: 'c',
                },
              ],
            },
          ],
        },
      ],
      counts: { unchanged: 0, upgradable: 1, needs_review: 2, unresolvable: 0 },
      requiresReview: true,
      isUpToDate: false,
    };

    it('counts nodes that still have missing conflict resolutions', () => {
      // No choices made yet: both node-1 and node-3 are unresolved
      expect(countUnresolvedNodes(plan, {})).toBe(2);

      // Resolve only 1 of 2 conflicts on node-1: still unresolved
      const partialChoice: ChoiceMap = {
        [conflictKey('/home', 'node-1', 'title')]: { action: 'keep_local' },
      };
      expect(countUnresolvedNodes(plan, partialChoice)).toBe(2);

      // Resolve both conflicts on node-1
      const resolvedNode1: ChoiceMap = {
        ...partialChoice,
        [conflictKey('/home', 'node-1', 'subtitle')]: { action: 'use_new' },
      };
      expect(countUnresolvedNodes(plan, resolvedNode1)).toBe(1);

      // Resolve node-3 as well
      const allResolved: ChoiceMap = {
        ...resolvedNode1,
        [conflictKey('/contact', 'node-3', 'email')]: {
          action: 'custom',
          text: '"info@example.com"',
        },
      };
      expect(countUnresolvedNodes(plan, allResolved)).toBe(0);
    });

    it('formats resolutions input omitting unneeded pages and invalid custom choices', () => {
      const choices: ChoiceMap = {
        [conflictKey('/home', 'node-1', 'title')]: { action: 'keep_local' },
        [conflictKey('/home', 'node-1', 'subtitle')]: { action: 'custom', text: 'bad{' },
        [conflictKey('/contact', 'node-3', 'email')]: {
          action: 'custom',
          text: '"test@domain.org"',
        },
      };

      const input = toResolutionsInput(plan, choices);

      expect(input).toEqual({
        '/home': {
          'node-1': {
            title: { action: 'keep_local' },
            // subtitle omitted because text was invalid
          },
        },
        '/contact': {
          'node-3': {
            email: { action: 'custom', value: 'test@domain.org' },
          },
        },
      });
    });
  });
});
