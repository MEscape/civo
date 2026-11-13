import { describe, expect, it } from 'vitest';

import { applyMigrationPlan } from '@modules/release/domain/migration/apply-migration';
import type { ConflictResolutions } from '@modules/release/domain/migration/conflict-resolution';
import type { MigrationPlan } from '@modules/release/domain/migration/migration-plan';
import type { PageTree, TreeNode } from '@modules/release/domain/migration/page-tree';

describe('applyMigrationPlan domain logic', () => {
  const rootNode: TreeNode = {
    id: 'hero-1',
    type: 'hero',
    props: { title: 'Old Title', legacySetting: 'active' },
    children: [],
  };

  const pages: PageTree[] = [
    {
      path: '',
      children: [rootNode],
    },
  ];

  it('leaves unchanged nodes untouched and reports no changed pages', () => {
    const plan: MigrationPlan = {
      pages: [
        {
          path: '',
          nodes: [
            {
              nodeId: 'hero-1',
              type: 'hero',
              status: 'unchanged',
              fromVersion: 1,
              toVersion: 1,
            },
          ],
        },
      ],
    };

    const result = applyMigrationPlan(plan, pages, {});
    expect(result.changedPages).toHaveLength(0);
    expect(result.skippedNodeCount).toBe(0);
  });

  it('applies mergedProps for upgradable nodes', () => {
    const plan: MigrationPlan = {
      pages: [
        {
          path: '',
          nodes: [
            {
              nodeId: 'hero-1',
              type: 'hero',
              status: 'upgradable',
              fromVersion: 1,
              toVersion: 2,
              mergedProps: { title: 'Old Title', newSetting: 'enabled' },
              addedFields: ['newSetting'],
            },
          ],
        },
      ],
    };

    const result = applyMigrationPlan(plan, pages, {});
    expect(result.changedPages).toHaveLength(1);
    expect(result.changedPages[0]?.updatedNodeIds).toEqual(['hero-1']);
    expect(result.changedPages[0]?.children[0]?.props).toEqual({
      title: 'Old Title',
      newSetting: 'enabled',
    });
    expect(result.skippedNodeCount).toBe(0);
  });

  it('applies conflict settlements for needs_review nodes', () => {
    const plan: MigrationPlan = {
      pages: [
        {
          path: '',
          nodes: [
            {
              nodeId: 'hero-1',
              type: 'hero',
              status: 'needs_review',
              fromVersion: 1,
              toVersion: 2,
              mergedProps: { title: 'Local Title', color: 'blue', legacySetting: 'active' },
              addedFields: [],
              conflicts: [
                {
                  kind: 'both_changed',
                  key: 'title',
                  base: 'Base',
                  local: 'Local Title',
                  incoming: 'Upstream Title',
                },
                {
                  kind: 'both_changed',
                  key: 'color',
                  base: 'gray',
                  local: 'blue',
                  incoming: 'green',
                },
                {
                  kind: 'removed_upstream',
                  key: 'legacySetting',
                  base: 'active',
                  local: 'active',
                },
              ],
            },
          ],
        },
      ],
    };

    const resolutions: ConflictResolutions = {
      '': {
        'hero-1': {
          title: { action: 'use_new' }, // should set to incoming ('Upstream Title')
          color: { action: 'custom', value: 'purple' }, // should set to custom ('purple')
          legacySetting: { action: 'use_new' }, // removed_upstream + use_new should remove key
        },
      },
    };

    const result = applyMigrationPlan(plan, pages, resolutions);
    expect(result.changedPages).toHaveLength(1);
    expect(result.changedPages[0]?.updatedNodeIds).toEqual(['hero-1']);
    expect(result.changedPages[0]?.children[0]?.props).toEqual({
      title: 'Upstream Title',
      color: 'purple',
    });
    expect(result.skippedNodeCount).toBe(0);
  });

  it('skips a needs_review node entirely if any conflict resolution is missing', () => {
    const plan: MigrationPlan = {
      pages: [
        {
          path: '',
          nodes: [
            {
              nodeId: 'hero-1',
              type: 'hero',
              status: 'needs_review',
              fromVersion: 1,
              toVersion: 2,
              mergedProps: { title: 'Local Title' },
              addedFields: [],
              conflicts: [
                {
                  kind: 'both_changed',
                  key: 'title',
                  base: 'Base',
                  local: 'Local Title',
                  incoming: 'Upstream Title',
                },
                {
                  kind: 'removed_upstream',
                  key: 'legacySetting',
                  base: 'active',
                  local: 'custom-active',
                },
              ],
            },
          ],
        },
      ],
    };

    // Only resolving title, leaving legacySetting unresolved
    const resolutions: ConflictResolutions = {
      '': {
        'hero-1': {
          title: { action: 'use_new' },
        },
      },
    };

    const result = applyMigrationPlan(plan, pages, resolutions);
    // Node remains untouched, no changed pages, skipped count is 1
    expect(result.changedPages).toHaveLength(0);
    expect(result.skippedNodeCount).toBe(1);
  });

  it('skips unresolvable nodes and increments skippedNodeCount', () => {
    const plan: MigrationPlan = {
      pages: [
        {
          path: '',
          nodes: [
            {
              nodeId: 'hero-1',
              type: 'hero',
              status: 'unresolvable',
              fromVersion: 1,
              reason: 'type_unregistered',
            },
          ],
        },
      ],
    };

    const result = applyMigrationPlan(plan, pages, {});
    expect(result.changedPages).toHaveLength(0);
    expect(result.skippedNodeCount).toBe(1);
  });
});
