import type { RateLimiter } from '@lib/rate-limit';

import type { AuthorizationService } from './authorization-service';
import type { ProfileAccount } from '../domain/ports/profile-account.port';
import type { ProfileImages } from '../domain/ports/profile-images.port';
import type { SecurityAuditLog } from '../domain/ports/security-audit-log.port';

export interface ProfileDependencies {
  readonly authorization: AuthorizationService;
  readonly account: ProfileAccount;
  readonly images: ProfileImages;
  readonly rateLimiter: RateLimiter;
  readonly audit: SecurityAuditLog;
}
