import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

export const MAP_RATE_LIMITS = {
  readWindow: {
    id: 'map.read-window-client',
    limit: 120,
    windowSeconds: SECONDS_PER_MINUTE,
    // @fail-open a published map that vanishes whenever the store is slow costs a visitor more than the gap in protection
    onBackendFailure: 'allow',
    onUnresolvedClient: 'deny',
  },
  save: {
    id: 'map.save-actor',
    limit: 30,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  delete: {
    id: 'map.delete-actor',
    limit: 30,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
