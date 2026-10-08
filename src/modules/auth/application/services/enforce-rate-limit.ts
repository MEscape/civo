import type { ForbiddenAppError, InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { rateLimited } from '../../domain/errors/auth-errors';
import { AUTH_RATE_LIMITS } from '../auth-limits';

import type { AuthRateLimitAction } from '../../domain/models/rate-limit';
import type { AuthenticationDependencies } from '../auth-dependencies';

export type RateLimitError = ForbiddenAppError | InfrastructureAppError;

/**
 * Counts one attempt and refuses it when the window is used up. Fails
 * closed: if the limiter itself is down the attempt is refused rather than
 * waved through. The refusal is audited; the caller only sees `rateLimited`.
 */
export function enforceRateLimit(
  deps: Pick<AuthenticationDependencies, 'rateLimiter' | 'audit'>,
  action: AuthRateLimitAction,
  subject: string,
): AppResultAsync<void, RateLimitError> {
  return deps.rateLimiter
    .consume({ action, subject, ...AUTH_RATE_LIMITS[action] })
    .andThen((decision): AppResultAsync<void, ForbiddenAppError> => {
      if (decision.isAllowed) {
        return okAsync(undefined);
      }

      deps.audit.record({ type: 'authentication.rate_limited', action });
      return errAsync(rateLimited());
    });
}
