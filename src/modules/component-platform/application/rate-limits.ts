import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

/**
 * Budgets for what a visitor of a published page can ask for again and again, per client address.
 *
 * Moving or zooming a chart asks the website's data source for another window of its records, and
 * every distinct window is a request that no cache has answered yet, so one visitor must not be
 * able to turn a page into a way of calling the municipality's API at will. It fails open when the
 * store is down (a chart that stops updating costs more than the gap in protection), and skips an
 * address that cannot be determined rather than refusing every visitor.
 */
export const COMPONENT_PLATFORM_RATE_LIMITS = {
  readTrendWindowClient: {
    id: 'component-platform.read-trend-window-client',
    limit: 60,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'allow',
    onUnresolvedClient: 'skip',
  },
} as const satisfies Record<string, RateLimitPolicy>;
