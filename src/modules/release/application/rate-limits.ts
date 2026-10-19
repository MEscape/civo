import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

/**
 * Budgets for what changes the live website or removes its data, per signed-in person. These are
 * deliberate, infrequent acts that read and write many records at once, so a handful a minute is
 * ample; each fails closed when the store is down, because what they change is what visitors see.
 */
export const RELEASE_RATE_LIMITS = {
  publish: {
    id: 'release.publish',
    limit: 10,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  rollback: {
    id: 'release.rollback',
    limit: 10,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  /** Reads the live release and every component it uses to plan a component update. */
  proposeMigration: {
    id: 'release.propose-migration',
    limit: 10,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  /** Rewrites every affected page draft. */
  applyMigration: {
    id: 'release.apply-migration',
    limit: 10,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  deleteUnusedData: {
    id: 'release.delete-unused-data',
    limit: 20,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
