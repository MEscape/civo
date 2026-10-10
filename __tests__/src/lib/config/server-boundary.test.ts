import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONFIG_DIR = resolve(import.meta.dirname, '../../../../src/lib/config');

/**
 * Importing a utility must never validate server secrets in a browser bundle,
 * where `process.env` is empty: that surfaced as "Invalid server environment
 * configuration" on pages whose Client Components import `@lib/errors`.
 */
describe('@lib/config client/server split', () => {
  it('keeps the server configuration behind server-only', () => {
    expect(readFileSync(resolve(CONFIG_DIR, 'server.ts'), 'utf8')).toMatch(
      /^import 'server-only';/m,
    );
  });

  it('keeps the barrel free of server configuration', () => {
    const barrel = readFileSync(resolve(CONFIG_DIR, 'index.ts'), 'utf8');
    expect(barrel).not.toMatch(/serverEnv|'\.\/server'|'\.\/env-schema'/);
  });
});
