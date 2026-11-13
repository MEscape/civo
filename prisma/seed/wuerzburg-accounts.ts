import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { hashPassword } from 'better-auth/crypto';
import { parse } from 'dotenv';
import { Client } from 'pg';

import { serverEnv } from '@lib/config/server';

import type { WuerzburgManifest } from './wuerzburg-manifest';

const PASSWORD_BYTES = 24;
const MIN_PASSWORD_LENGTH = 16;
const PASSWORD_FILE = new URL('../../.env.wuerzburg.local', import.meta.url);

async function demoPassword(): Promise<string> {
  if (serverEnv.WUERZBURG_DEMO_PASSWORD !== undefined) {
    return serverEnv.WUERZBURG_DEMO_PASSWORD;
  }
  try {
    const values = parse(await readFile(PASSWORD_FILE));
    const password = values['WUERZBURG_DEMO_PASSWORD'];
    if (password === undefined || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error('Invalid local demo credential file');
    }
    return password;
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }
  const password = randomBytes(PASSWORD_BYTES).toString('base64url');
  await writeFile(
    PASSWORD_FILE,
    `# Development-only generated demo credential. Never commit this file.\nWUERZBURG_DEMO_PASSWORD=${password}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  return password;
}

/** Idempotent auth provisioning has a separate transaction because Better Auth owns a separate database. */
export async function seedWuerzburgAccounts(manifest: WuerzburgManifest): Promise<boolean> {
  if (serverEnv.NODE_ENV === 'production') {
    throw new Error('Demo identities are forbidden in production');
  }
  if (serverEnv.AUTH_DATABASE_URL === undefined) {
    return false;
  }
  const password = await demoPassword();
  const client = new Client({
    connectionString: serverEnv.AUTH_DATABASE_URL,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('seed:wuerzburg:auth', 0))");
    for (const account of manifest.accounts) {
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM "user" WHERE id=$1 OR email=$2',
        [account.id, account.email],
      );
      if (existing.rows.some((row) => row.id !== account.id)) {
        throw new Error('Demo email belongs to an existing identity; seed refused');
      }
      if (existing.rowCount === 0) {
        const hash = await hashPassword(password);
        await client.query(
          'INSERT INTO "user" (id,name,email,"emailVerified") VALUES ($1,$2,$3,true)',
          [account.id, account.name, account.email],
        );
        await client.query(
          'INSERT INTO account (id,"accountId","providerId","userId",password,"updatedAt") VALUES ($1,$2,\'credential\',$2,$3,CURRENT_TIMESTAMP)',
          [`${account.id}-credential`, account.id, hash],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
  return true;
}
