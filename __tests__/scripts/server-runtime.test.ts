import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const runNode = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUNTIME = pathToFileURL(resolve(ROOT, 'scripts/lib/server-runtime.ts')).href;

function execute(source: string, options: { useRuntime: boolean }) {
  const env = { ...process.env };
  // Each child starts without inherited loader hooks or export conditions.
  delete env['NODE_OPTIONS'];
  return runNode(
    process.execPath,
    [...(options.useRuntime ? ['--import', RUNTIME] : []), '--input-type=module', '--eval', source],
    { cwd: ROOT, env, timeout: 10_000 },
  );
}

describe('development CLI server runtime', () => {
  it('retains the server-only guard in an ordinary Node process', async () => {
    await expect(
      execute("await import('server-only');", { useRuntime: false }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        'This module cannot be imported from a Client Component module.',
      ),
    });
  });

  it('loads trusted server modules while retaining ordinary React client exports', async () => {
    const result = await execute(
      `await import('server-only');
const React = await import('react');
console.log(JSON.stringify({
  useState: typeof React.useState,
  createContext: typeof React.createContext,
  useEffect: typeof React.useEffect,
}));`,
      { useRuntime: true },
    );

    expect(JSON.parse(result.stdout)).toEqual({
      useState: 'function',
      createContext: 'function',
      useEffect: 'function',
    });
    expect(result.stderr).toBe('');
  });

  it('preserves package export restrictions for other specifiers', async () => {
    await expect(
      execute("await import('server-only/unlisted.js');", { useRuntime: true }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('ERR_PACKAGE_PATH_NOT_EXPORTED'),
    });
  });
});
