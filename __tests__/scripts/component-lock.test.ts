import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { currentComponentLock, runComponentLock } from '../../scripts/commands/component-lock';
import { PATHS } from '../../scripts/lib/config';

import { REAL_ROOT, changedPaths, makeRepo, snapshot } from './helpers';

describe('gen component-lock', () => {
  it('writes the lock of the registered components, formatted, and nothing else', async () => {
    const root = makeRepo();
    const before = snapshot(root);

    const output = await runComponentLock([], { root });

    expect(output).toContain('Created 1 file(s):');
    expect(changedPaths(before, snapshot(root))).toEqual([PATHS.componentLock]);
    const written = readFileSync(join(root, PATHS.componentLock), 'utf8');
    expect(JSON.parse(written)).toEqual(currentComponentLock());
    expect(written.endsWith('}\n')).toBe(true);
  });

  it('says so when the lock is already current, and rewrites it after a change', async () => {
    const root = makeRepo();
    await runComponentLock([], { root });

    expect(await runComponentLock([], { root })).toContain('is up to date');

    const path = join(root, PATHS.componentLock);
    const stale = JSON.parse(readFileSync(path, 'utf8')) as Record<string, { version: number }>;
    const [type = ''] = Object.keys(stale);
    stale[type] = { version: 0 };
    writeFileSync(path, JSON.stringify(stale, null, 2));

    expect(await runComponentLock([], { root })).toContain('Edited 1 file(s):');
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(currentComponentLock());
  });

  it('writes nothing on --dry-run', async () => {
    const root = makeRepo();
    const before = snapshot(root);

    const output = await runComponentLock(['--dry-run'], { root });

    expect(output).toContain('Would create 1 file(s):');
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('rejects stray arguments', async () => {
    await expect(runComponentLock(['extra'], { root: makeRepo() })).rejects.toThrow(
      /Unexpected argument/,
    );
  });

  it('finds the real lock up to date', async () => {
    expect(await runComponentLock(['--dry-run'], { root: REAL_ROOT })).toContain('is up to date');
  });
});
