/**
 * scripts/apply-auth-migration.ts
 *
 * Applies auth-owned SQL migrations that live outside the Prisma schema.
 * Run via: tsx scripts/apply-auth-migration.ts
 *
 * Each migration is idempotent (uses IF NOT EXISTS / ON CONFLICT guards),
 * so re-running is safe in both development and production.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { config } from 'dotenv';
import { Pool } from 'pg';

config();

interface Migration {
  readonly file: string;
  readonly description: string;
}

const MIGRATIONS: readonly Migration[] = [
  {
    file: join('migrations', 'auth', '0001_auth_rate_limit.sql'),
    description: 'auth_rate_limit table',
  },
];

async function applyMigration(pool: Pool, migration: Migration): Promise<void> {
  const sql = await readFile(join(process.cwd(), migration.file), 'utf-8');
  await pool.query(sql);
  process.stdout.write(`  applied: ${migration.description}\n`);
}

async function main(): Promise<void> {
  const url = process.env['AUTH_DATABASE_URL'];

  if (!url) {
    process.stdout.write('AUTH_DATABASE_URL is not set — skipping auth migrations.\n');
    return;
  }

  process.stdout.write(`Applying ${MIGRATIONS.length} auth migration(s)...\n`);

  const pool = new Pool({ connectionString: url });

  try {
    for (const migration of MIGRATIONS) {
      await applyMigration(pool, migration);
    }
    process.stdout.write('Auth migrations complete.\n');
  } catch (error) {
    process.stderr.write(
      `Auth migration failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Unexpected error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
