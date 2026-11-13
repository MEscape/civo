import { logger } from '@lib/logger';

import type { SqlMiddleware } from '@prisma/orm-postgres/family-runtime';

const dbLogger = logger.withContext({ module: 'infrastructure.prisma' });
const STATEMENT_SQL = Symbol('query-logger.sql');

/**
 * Query-observability middleware for the Prisma ORM Postgres runtime.
 *
 * Prisma 8 has no `log: [...]` client option; the runtime instead calls
 * `beforeEncode`/`activityEnded` hooks on middleware registered in the
 * `middleware` array (see `client.ts`). `ctx.log` is a documented no-op on
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

    beforeEncode(plan, ctx) {
      const state = ctx.state(STATEMENT_SQL);
      state['sql'] = plan.sql;
    },

    activityEnded(_activity, result, ctx) {
      if (result.kind !== 'statement') {
        return Promise.resolve();
      }
      const isQuery = result.returns === 'rows';
      const completed = result.outcome === 'succeeded';
      const fields = {
        sql: ctx.state(STATEMENT_SQL)['sql'],
        ...(isQuery
          ? { rowCount: result.rowCount }
          : { affectedRows: completed ? (result.stats?.affectedRows ?? 0) : 0 }),
        latencyMs: Math.round(result.latencyMs),
        completed,
        source: result.source,
      };
      dbLogger.debug(isQuery ? 'db.query' : 'db.execute', fields);
      if (!completed) {
        dbLogger.warn(isQuery ? 'db.query.failed' : 'db.execute.failed', fields);
      }
      return Promise.resolve();
    },
  };
}
