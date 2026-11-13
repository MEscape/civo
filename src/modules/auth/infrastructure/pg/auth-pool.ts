import { Pool } from 'pg';

import { logger } from '@lib/logger';

const poolLogger = logger.withContext({ module: 'auth.pg' });
const IDLE_TIMEOUT_MS = 30_000;

export interface AuthPoolSettings {
  readonly databaseUrl: string;
  readonly maxConnections: number;
  readonly connectionTimeoutMs: number;
  readonly statementTimeoutMs: number;
  /** True outside production: reuse one pool across dev hot reloads. */
  readonly reuseAcrossReloads: boolean;
}

const globalForAuth = globalThis as unknown as {
  authPool: Pool | undefined;
}; // globalThis has no declared shape; this is the standard hot-reload singleton pattern.

function createAuthPool(settings: AuthPoolSettings): Pool {
  const pool = new Pool({
    connectionString: settings.databaseUrl,
    max: settings.maxConnections,
    connectionTimeoutMillis: settings.connectionTimeoutMs,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    statement_timeout: settings.statementTimeoutMs,
  });
  // An idle client can error after the request that used it is gone. Without
  // a listener that is an unhandled 'error' event and crashes the process.
  // The connection string is never logged: it can embed credentials.
  pool.on('error', (error) => {
    poolLogger.error('auth.pool_error', error);
  });
  return pool;
}

/**
 * The one `pg` pool of the auth database, shared by Better Auth and the
 * account directory. Prisma 8's Postgres runtime has no Better Auth adapter, so
 * Better Auth owns its tables through plain `pg` and Prisma never touches
 * them. `AUTH_DATABASE_URL` should point at a role that can reach only the
 * auth schema, so a flaw on either side cannot read the other's data.
 */
export function getAuthPool(settings: AuthPoolSettings): Pool {
  const pool = globalForAuth.authPool ?? createAuthPool(settings);
  if (settings.reuseAcrossReloads) {
    globalForAuth.authPool = pool;
  }
  return pool;
}
