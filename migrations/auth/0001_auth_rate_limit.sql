-- Auth database (the one AUTH_DATABASE_URL points at, owned by `pg`, not Prisma).
-- Run it as a reviewed migration next to Better Auth's own `@better-auth/cli migrate`.
-- Used by PgAuthRateLimiter; see application/rate-limit-policy.ts for the budgets.

CREATE TABLE IF NOT EXISTS auth_rate_limit (
  bucket_key        text        PRIMARY KEY,           -- "<action>:<hmac of subject>", never an email
  hits              integer     NOT NULL CHECK (hits >= 0),
  window_started_at timestamptz NOT NULL
);

-- Lets the retention job below find expired buckets without a full scan.
CREATE INDEX IF NOT EXISTS auth_rate_limit_window_started_at_idx
  ON auth_rate_limit (window_started_at);

-- Retention: buckets are useless once their window is over (the longest window is one hour).
-- Schedule this daily (pg_cron, a platform cron, ...). Without it the table grows with every
-- distinct subject an attacker tries.
--   DELETE FROM auth_rate_limit WHERE window_started_at < now() - interval '1 day';
