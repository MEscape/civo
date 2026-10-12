import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { COMPONENT_LOCK_PATH, currentComponentLock } from '../../scripts/component-version-lock';

import type { ComponentLock } from '../../scripts/component-version-lock';

const UPDATE_HINT = 'Run `npm run components:lock` to record it.';

function readLock(): ComponentLock {
  return JSON.parse(readFileSync(COMPONENT_LOCK_PATH, 'utf8')) as ComponentLock;
}

/** What is wrong with the lock, one line per component; empty when the versions are honest. */
function describeLockProblems(locked: ComponentLock, current: ComponentLock): string[] {
  const problems: string[] = [];
  for (const [type, now] of Object.entries(current)) {
    const before = locked[type];
    if (before === undefined) {
      problems.push(`${type}: new component. ${UPDATE_HINT}`);
    } else if (before.fingerprint !== now.fingerprint && before.version === now.version) {
      problems.push(
        `${type}: its props or data binding changed but \`version\` is still ${String(now.version)}. ` +
          `Raise \`version\` in its definition: releases that pinned the old shape are offered the update. ${UPDATE_HINT}`,
      );
    } else if (before.version !== now.version || before.fingerprint !== now.fingerprint) {
      problems.push(`${type}: the lock is out of date. ${UPDATE_HINT}`);
    }
  }
  for (const type of Object.keys(locked)) {
    if (current[type] === undefined) {
      problems.push(`${type}: removed component. ${UPDATE_HINT}`);
    }
  }
  return problems;
}

describe('component versions', () => {
  it('are raised whenever a component changes what a stored page can depend on', () => {
    const problems = describeLockProblems(readLock(), currentComponentLock());
    expect(problems, `\n${problems.join('\n')}\n`).toEqual([]);
  });

  describe('the check itself', () => {
    const lock: ComponentLock = { hero: { version: 1, fingerprint: 'aaaa' } };

    it('accepts an unchanged component', () => {
      expect(describeLockProblems(lock, lock)).toEqual([]);
    });

    it('asks for a version bump when the shape changed under the same version', () => {
      const changed = { hero: { version: 1, fingerprint: 'bbbb' } };
      expect(describeLockProblems(lock, changed)[0]).toContain('Raise `version`');
    });

    it('asks only for the lock to be updated once the version was raised', () => {
      const bumped = { hero: { version: 2, fingerprint: 'bbbb' } };
      expect(describeLockProblems(lock, bumped)[0]).toContain('out of date');
    });

    it('notices new and removed components', () => {
      expect(
        describeLockProblems(lock, { ...lock, news: { version: 1, fingerprint: 'cccc' } }),
      ).toEqual([expect.stringContaining('news: new component')]);
      expect(describeLockProblems(lock, {})).toEqual([expect.stringContaining('hero: removed')]);
    });
  });
});
