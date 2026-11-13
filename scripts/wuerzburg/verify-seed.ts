import 'dotenv/config';
import '../lib/server-runtime';

import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { Client } from 'pg';

import { readWuerzburgManifest } from '../../prisma/seed/wuerzburg-manifest';
import seed from '../../prisma/seed/wuerzburg.seed';
import { serverEnv } from '../../src/lib/config/server';
import { disconnectDb } from '../../src/lib/db';

const MAX_ROWS = 10_000;
const TABLES = [
  'Website',
  'WebsiteTheme',
  'Page',
  'PageConfig',
  'DataSource',
  'Dataset',
  'Membership',
  'Invitation',
  'BookingLocation',
  'BookableResource',
  'BookableService',
  'BookableServiceLocation',
  'Booking',
  'BookingAssignment',
  'WebsiteRelease',
] as const;

/** Read-only digests include timestamps and revisions, so needless updates fail the check. */
async function databaseSnapshot(): Promise<Record<string, { count: number; hash: string }>> {
  const client = new Client({
    connectionString: serverEnv.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  const result: Record<string, { count: number; hash: string }> = {};
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    for (const table of TABLES) {
      // Table identifiers come only from this file's fixed allowlist.
      const rows = await client.query(
        `SELECT to_jsonb(record) AS value FROM "${table}" AS record LIMIT $1`,
        [MAX_ROWS],
      );
      if (rows.rowCount === MAX_ROWS) {
        throw new Error('Seed verification exceeds its read bound');
      }
      const values = rows.rows.map((row: { value: unknown }) => JSON.stringify(row.value)).sort();
      result[table] = {
        count: values.length,
        hash: createHash('sha256').update(JSON.stringify(values)).digest('hex'),
      };
    }
    await client.query('COMMIT');
    return result;
  } finally {
    await client.end();
  }
}

if (serverEnv.NODE_ENV === 'production') {
  throw new Error('Reference seed verification is development-only');
}
const manifest = await readWuerzburgManifest();
try {
  const context = {
    say: (message: string) => process.stdout.write(`${message}\n`),
    tally: { created: 0, skipped: 0 },
  };
  await seed.run(context);
  const before = await databaseSnapshot();
  await seed.run(context);
  const after = await databaseSnapshot();
  const changed = TABLES.filter(
    (table) => JSON.stringify(before[table]) !== JSON.stringify(after[table]),
  );
  const report = {
    capturedAt: new Date().toISOString(),
    websiteId: manifest.websiteId,
    passed: changed.length === 0,
    changedTables: changed,
    before,
    after,
    limitation:
      'Application tables checked; auth credential hashes are deliberately excluded. No reset or fresh database was exercised.',
  };
  await writeFile(
    new URL('../../docs/würzburg/verification/seed-idempotency.json', import.meta.url),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (changed.length > 0) {
    throw new Error(`Repeated seed changed tables: ${changed.join(', ')}`);
  }
  process.stdout.write(
    'Passed: two consecutive seeds leave all checked application tables byte-equivalent.\n',
  );
} finally {
  await disconnectDb();
}
