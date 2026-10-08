import { describe, expect, it } from 'vitest';

import type { MigrationPlan } from '@modules/release/domain/models/migration-plan';
import {
  restoreMigrationPlan,
  serializeMigrationPlan,
} from '@modules/release/domain/models/stored-migration-plan';

const base = { type: 'eventsGrid', fromVersion: 1 } as const;

const PLAN: MigrationPlan = {
  pages: [
    {
      path: '',
      nodes: [
        { ...base, nodeId: 'a', status: 'unchanged', toVersion: 1 },
        {
          ...base,
          nodeId: 'b',
          status: 'upgradable',
          toVersion: 2,
          mergedProps: { heading: 'News' },
          addedFields: ['limit'],
        },
        {
          ...base,
          nodeId: 'c',
          status: 'needs_review',
          toVersion: 2,
          mergedProps: { heading: 'Mine' },
          addedFields: [],
          conflicts: [
            {
              kind: 'both_changed',
              key: 'heading',
              base: 'Old',
              local: 'Mine',
              incoming: 'Theirs',
            },
            { kind: 'removed_upstream', key: 'legacy', local: true },
          ],
        },
        { ...base, nodeId: 'd', status: 'unresolvable', reason: 'type_unregistered' },
      ],
    },
  ],
};

describe('stored migration plan', () => {
  it('restores exactly what it serialized, for every node status', () => {
    const restored = restoreMigrationPlan(serializeMigrationPlan(PLAN));
    expect(restored.isOk() && restored.value).toEqual(PLAN);
  });

  it.each([
    ['an unknown schema version', { schemaVersion: 99, pages: [] }],
    [
      'an unknown status',
      {
        schemaVersion: 1,
        pages: [{ path: '', nodes: [{ ...base, nodeId: 'x', status: 'gone' }] }],
      },
    ],
    [
      'an upgrade without merged props',
      {
        schemaVersion: 1,
        pages: [
          {
            path: '',
            nodes: [{ ...base, nodeId: 'x', status: 'upgradable', toVersion: 2, addedFields: [] }],
          },
        ],
      },
    ],
    [
      'a review with a malformed conflict',
      {
        schemaVersion: 1,
        pages: [
          {
            path: '',
            nodes: [
              {
                ...base,
                nodeId: 'x',
                status: 'needs_review',
                toVersion: 2,
                mergedProps: {},
                addedFields: [],
                conflicts: [{ kind: 'both_changed' }],
              },
            ],
          },
        ],
      },
    ],
    [
      'an unknown unresolvable reason',
      {
        schemaVersion: 1,
        pages: [
          { path: '', nodes: [{ ...base, nodeId: 'x', status: 'unresolvable', reason: 'shrug' }] },
        ],
      },
    ],
  ])('rejects %s as a whole', (_, stored) => {
    expect(restoreMigrationPlan(stored).isErr()).toBe(true);
  });
});
