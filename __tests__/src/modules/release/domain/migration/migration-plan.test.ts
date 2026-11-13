import { describe, expect, it } from 'vitest';

import { summarizeComponentUpdates } from '@modules/release/domain/migration/migration-plan';
import type {
  MigrationPlan,
  NodeMigrationPlan,
} from '@modules/release/domain/migration/migration-plan';

const node = (
  nodeId: string,
  type: string,
  status: NodeMigrationPlan['status'],
  fromVersion = 1,
  toVersion = 2,
): NodeMigrationPlan =>
  ({
    nodeId,
    type,
    status,
    fromVersion,
    toVersion,
    addedFields: ['newSetting'],
    conflicts: [{ kind: 'removed_upstream', key: 'title', local: 'x' }],
    ...(status === 'unresolvable' ? { reason: 'type_unregistered' } : {}),
  }) as NodeMigrationPlan;

const plan = (pages: Record<string, NodeMigrationPlan[]>): MigrationPlan => ({
  pages: Object.entries(pages).map(([path, nodes]) => ({ path, nodes })),
});

describe('the component updates of a plan', () => {
  it('say nothing of components that are current', () => {
    expect(summarizeComponentUpdates(plan({ '': [node('a', 'hero', 'unchanged')] }))).toEqual([]);
  });

  it('count each component once, with its uses and the pages it is on', () => {
    const summary = summarizeComponentUpdates(
      plan({
        '': [node('a', 'hero', 'upgradable'), node('b', 'hero', 'upgradable')],
        news: [node('c', 'hero', 'upgradable'), node('d', 'newsGrid', 'unchanged')],
      }),
    );

    expect(summary).toEqual([
      {
        type: 'hero',
        fromVersion: 1,
        toVersion: 2,
        usageCount: 3,
        pageCount: 2,
        pagePaths: ['', 'news'],
        status: 'upgradable',
        addedFields: ['newSetting'],
        conflictFields: [],
      },
    ]);
  });

  it('report the hardest status of a component whose uses differ, and list those first', () => {
    const summary = summarizeComponentUpdates(
      plan({
        '': [
          node('a', 'alpha', 'upgradable'),
          node('b', 'beta', 'upgradable'),
          node('c', 'beta', 'needs_review'),
          node('d', 'gamma', 'unresolvable'),
        ],
      }),
    );

    expect(summary.map(({ type, status }) => [type, status])).toEqual([
      ['gamma', 'unresolvable'],
      ['beta', 'needs_review'],
      ['alpha', 'upgradable'],
    ]);
  });
});
