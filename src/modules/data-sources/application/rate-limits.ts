import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

/**
 * Budgets for the operations that call a data source's external system, per signed-in person.
 * Every call leaves our network and costs the owner of that system something, so a stuck
 * script must not be able to turn the editor into a request cannon; each fails closed when the
 * store is down, for the same reason.
 */
export const DATA_SOURCE_RATE_LIMITS = {
  /** A button the editor presses to see whether the source answers. */
  testConnection: {
    id: 'data-sources.test-connection',
    limit: 10,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  /** Reads a live sample to list the fields of a dataset. */
  discoverDataset: {
    id: 'data-sources.discover-dataset',
    limit: 20,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  /** Runs while the editor edits a mapping, one live record per change. */
  previewMapping: {
    id: 'data-sources.preview-mapping',
    limit: 60,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  /** Saving a mapping dry-runs it against a live record first. */
  saveMapping: {
    id: 'data-sources.save-mapping',
    limit: 20,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
