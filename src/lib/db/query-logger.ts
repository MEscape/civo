import { logger } from '@lib/logger';

import type { SqlMiddleware } from '@prisma/orm-postgres/family-runtime';

const dbLogger = logger.withContext({ module: 'infrastructure.prisma' });

/**
 * Query-observability middleware for the Prisma ORM Postgres runtime.
 *
 * Prisma 8 has no `log: [...]` client option; the runtime instead calls
 * `afterQuery`/`afterExecute` hooks on middleware registered in the
 * `middleware` array (see db.ts). `ctx.log` is a documented no-op on
 * Postgres today, so this middleware routes through the app's own
 * `logger` instead — observability.md: "do not use console.log for
 * application observability", "log at application/infrastructure
 * boundaries".
 *
 * Every query is logged at `debug` with full SQL/timing detail, and a
 * failed query is additionally logged at `warn` regardless of level.
 * This middleware makes no `NODE_ENV` decision itself: `@lib/logger`
 * filters by `LOG_LEVEL` at the sink, so `LOG_LEVEL=debug` in development
 * shows every query and `LOG_LEVEL=warn` (typical in production) shows
 * only failed ones — configuration.md: centralize environment-driven
 * behavior instead of branching on `NODE_ENV` at each call site.
 *
 * Only `plan.sql` (the parameterized query text, e.g. `... = $1`) and
 * timing/row-count metadata are logged — never bound parameter values,
 * which may carry user data or secrets (security.md / observability.md:
 * "never log secrets or sensitive data").
 */
export function queryLogger(): SqlMiddleware {
  return {
    name: 'query-logger',
    familyId: 'sql',

    afterQuery(plan, result) {
      const fields = {
        sql: plan.sql,
        rowCount: result.rowCount,
        latencyMs: Math.round(result.latencyMs),
        completed: result.completed,
        source: result.source,
      };
      dbLogger.debug('db.query', fields);
      if (!result.completed) {
        dbLogger.warn('db.query.failed', fields);
      }
      return Promise.resolve();
    },

    afterExecute(plan, result) {
      const affectedRows = result.completed ? result.stats.affectedRows : 0;
      const fields = {
        sql: plan.sql,
        affectedRows,
        latencyMs: Math.round(result.latencyMs),
        completed: result.completed,
        source: result.source,
      };
      dbLogger.debug('db.execute', fields);
      if (!result.completed) {
        dbLogger.warn('db.execute.failed', fields);
      }
      return Promise.resolve();
    },
  };
}
