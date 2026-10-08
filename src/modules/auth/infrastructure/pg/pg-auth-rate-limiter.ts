import { createHmac } from 'node:crypto';

import { z } from 'zod';

import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { rateLimiterFailed } from '../../domain/errors/auth-errors';

import type {
  AuthRateLimiter,
  RateLimitDecision,
  RateLimitRequest,
} from '../../domain/ports/auth-rate-limiter.port';
import type { Pool } from 'pg';

/**
 * One atomic statement counts the attempt and reports the window, so two
 * concurrent requests cannot both read "9 of 10" and both pass. A window
 * that has run out is restarted by the same statement.
 *
 * Table: see migrations/auth/0001_auth_rate_limit.sql
 */
const CONSUME_SQL = `
INSERT INTO auth_rate_limit AS limits (bucket_key, hits, window_started_at)
VALUES ($1, 1, now())
ON CONFLICT (bucket_key) DO UPDATE SET
  hits = CASE
    WHEN limits.window_started_at <= now() - make_interval(secs => $2::double precision) THEN 1
    ELSE limits.hits + 1
  END,
  window_started_at = CASE
    WHEN limits.window_started_at <= now() - make_interval(secs => $2::double precision) THEN now()
    ELSE limits.window_started_at
  END
RETURNING
  hits,
  GREATEST(0, CEIL(EXTRACT(EPOCH FROM (window_started_at + make_interval(secs => $2::double precision) - now()))))::int AS retry_after_seconds
`;

/** Driver output is external data, so its shape is parsed, not assumed (validation.md). */
const consumeRowSchema = z.object({
  hits: z.number().int(),
  retry_after_seconds: z.number().int(),
});

/**
 * Fixed-window limiter on the auth database. Subjects (emails) are keyed
 * by an HMAC so no address is stored in clear and the table is useless for
 * harvesting addresses.
 */
export class PgAuthRateLimiter implements AuthRateLimiter {
  constructor(
    private readonly pool: Pick<Pool, 'query'>,
    private readonly keySecret: string,
  ) {}

  consume(request: RateLimitRequest): AppResultAsync<RateLimitDecision, InfrastructureAppError> {
    const bucketKey = `${request.action}:${this.hashSubject(request.subject)}`;

    return fromThrowableAsync(async () => {
      const result = await this.pool.query(CONSUME_SQL, [bucketKey, request.windowSeconds]);
      return consumeRowSchema.parse(result.rows[0]);
    }, rateLimiterFailed).map((row): RateLimitDecision =>
      row.hits <= request.limit
        ? { isAllowed: true }
        : { isAllowed: false, retryAfterSeconds: row.retry_after_seconds },
    );
  }

  private hashSubject(subject: string): string {
    return createHmac('sha256', this.keySecret).update(subject).digest('hex');
  }
}
