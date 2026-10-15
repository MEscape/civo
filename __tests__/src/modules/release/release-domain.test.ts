import { describe, expect, it } from 'vitest';

import { summarizeComponentUpdates } from '@modules/release/domain/models/migration-plan';
import type {
  MigrationPlan,
  NodeMigrationPlan,
} from '@modules/release/domain/models/migration-plan';
import { describePreviewFidelity } from '@modules/release/domain/models/preview-fidelity';
import {
  RELEASE_NOTE_MAX_LENGTH,
  normalizeReleaseNote,
} from '@modules/release/domain/models/release-changes';
import type { ComponentCatalog } from '@modules/release/domain/ports/component-catalog.port';

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

describe('a release note', () => {
  it('is trimmed, and absent when nothing is left', () => {
    expect(normalizeReleaseNote('  Contact updated  ')).toBe('Contact updated');
    expect(normalizeReleaseNote('   ')).toBeNull();
    expect(normalizeReleaseNote(undefined)).toBeNull();
  });

  it('never exceeds the limit, whatever was sent', () => {
    expect(normalizeReleaseNote('x'.repeat(RELEASE_NOTE_MAX_LENGTH + 50))).toHaveLength(
      RELEASE_NOTE_MAX_LENGTH,
    );
  });
});

describe('how faithfully an old release can be shown', () => {
  const pin = (type: string, version: number) => ({ type, version, contracts: [] });
  const catalog = (current: Record<string, number>): ComponentCatalog => ({
    resolve: (type) =>
      type in current ? { type, version: current[type] ?? 0, contracts: [] } : null,
    defaultProps: () => null,
  });

  it('is exact when every component is at the version the release was built with', () => {
    const fidelity = describePreviewFidelity(
      [pin('hero', 1), pin('news', 2)],
      catalog({ hero: 1, news: 2 }),
    );

    expect(fidelity).toEqual({ status: 'exact', deviations: [] });
  });

  it('says it can look different when components moved on, and names them', () => {
    const fidelity = describePreviewFidelity(
      [pin('hero', 1), pin('news', 2)],
      catalog({ hero: 3, news: 2 }),
    );

    expect(fidelity.status).toBe('changed');
    expect(fidelity.deviations).toEqual([{ type: 'hero', pinnedVersion: 1, currentVersion: 3 }]);
  });

  it('says it cannot be shown as it was when a component is gone, and lists the gone ones first', () => {
    const fidelity = describePreviewFidelity(
      [pin('alpha', 1), pin('zulu', 1)],
      catalog({ alpha: 2 }),
    );

    expect(fidelity.status).toBe('unavailable');
    expect(fidelity.deviations.map((deviation) => deviation.type)).toEqual(['zulu', 'alpha']);
  });
});
