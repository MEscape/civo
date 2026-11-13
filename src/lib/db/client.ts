import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
// Prisma 8 reads and writes `DateTime` through the global `Temporal`, which Node 24 (pinned in
// `.nvmrc`) lacks. The `global` entry installs the polyfill only when there is no native
// implementation, and it must run before the first query decodes a row or fills a `now()` default.
import 'temporal-polyfill/global';
import { Pool } from 'pg';

import { serverEnv } from '@lib/config/server';
import { logger } from '@lib/logger';
import { MS_PER_SECOND } from '@lib/utils';

import contractJson from './contract.json' with { type: 'json' };
import { queryLogger } from './query-logger';

import type { Contract } from './contract.d';

const contract = contractFromJson<Contract>(contractJson);

/*
 * Prisma client singleton. This is the ONLY file in the codebase that may import
 * `@prisma/orm-postgres/runtime` directly (persistence.md; boundaries.md enforces it in lint).
 * Repositories import `db` from here.
 *
 * Prisma 8 uses the generated contract and the ORM Postgres runtime rather than the traditional
 * `PrismaClient` from `@prisma/client`.
 */

/** The client Prisma 8's ORM Postgres runtime builds from the generated contract. */
type PrismaClient = ReturnType<typeof postgres<Contract>>;

/** The client and the connection pool it runs on; the pool is ours to size and to close. */
interface Database {
  readonly client: PrismaClient;
  readonly pool: Pool;
}

/**
 * The globalThis cache prevents Next.js's dev-mode module reloading from
 * creating a new client (and a new connection pool) on every hot
 * reload. Without this cache, active development can exhaust the
 * database's connection limit within minutes.
 */
const globalForDatabase = globalThis as unknown as {
  database: Database | undefined;
};

const dbLogger = logger.withContext({ module: 'infrastructure.prisma' });

/** How long an unused connection is kept open before the pool closes it. */
const IDLE_TIMEOUT_MS = 30_000;

/** What the database's own views (`pg_stat_activity`) call these connections. */
const APPLICATION_NAME = 'civo';

/**
 * The connection pool, sized from the validated server configuration.
 *
 * The runtime's own `url` binding builds its pool with a fixed size and ignores the
 * `connection_limit` and `pool_timeout` connection-string parameters, so `DATABASE_POOL_SIZE` and
 * `DATABASE_POOL_TIMEOUT_SECONDS` only take effect on a pool built here and handed over as `pg`.
 * With a managed database such as Neon, whose connection count is capped per plan, the size is a
 * real limit, not a tuning detail.
 *
 * `DATABASE_URL` is required by the configuration schema, so missing database configuration fails
 * during application startup rather than falling back to a local or otherwise implicit database.
 * The URL can carry credentials and is never logged.
 */
function createPool(): Pool {
  const pool = new Pool({
    connectionString: serverEnv.DATABASE_URL,
    max: serverEnv.DATABASE_POOL_SIZE,
    connectionTimeoutMillis: serverEnv.DATABASE_POOL_TIMEOUT_SECONDS * MS_PER_SECOND,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    statement_timeout: serverEnv.DATABASE_STATEMENT_TIMEOUT_SECONDS * MS_PER_SECOND,
    application_name: APPLICATION_NAME,
  });
  // The server may end an idle connection at any time (a managed database recycles them). The pool
  // reports that as an 'error' event, and an event without a listener crashes the process; the pool
  // drops the connection and opens a new one on demand, so logging is all that is left to do.
  pool.on('error', (error) => {
    dbLogger.warn('db.pool.idle_connection_failed', { reason: error.message });
  });
  return pool;
}

/**
 * Creates the Prisma ORM Postgres client using the generated database
 * contract on the pool above.
 *
 * `queryLogger` is registered here rather than left for callers to add,
 * so every query on this client is observed the same way in every
 * environment — observability.md: "log at application/infrastructure
 * boundaries".
 */
function createDatabase(): Database {
  const pool = createPool();
  const client = postgres({
    contract,
    pg: pool,
    middleware: [queryLogger()],
  });
  return { pool, client };
}

/**
 * Reuse the existing database when available; otherwise create exactly one.
 *
 * Production does not need the global cache because the application
 * lifecycle is expected to be stable and module initialization occurs
 * once per process.
 */
const database = globalForDatabase.database ?? createDatabase();

if (serverEnv.NODE_ENV !== 'production') {
  globalForDatabase.database = database;
}

/**
 * The one database client of this process. Every query goes through the pool built from the
 * validated `DATABASE_*` settings and is observed by `queryLogger`.
 */
export const db = database.client;

/**
 * Gracefully terminates the database connections.
 *
 * This is primarily intended for long-running processes such as workers,
 * scripts, and CLI processes. The Next.js request lifecycle does not
 * normally require explicit disconnection.
 *
 * A failure here is logged once at this boundary (observability.md) and
 * rethrown as-is, rather than translated into a domain/application error
 * type — a process shutting down is not a case any caller is expected to
 * recover from (errors.md: reserve `throw` for failures no caller can
 * meaningfully handle).
 */
export async function disconnectDb(): Promise<void> {
  try {
    await database.client.close();
    if (!database.pool.ending) {
      await database.pool.end();
    }
  } catch (error) {
    dbLogger.error('db.disconnect_failed', error);
    throw error;
  }
}
