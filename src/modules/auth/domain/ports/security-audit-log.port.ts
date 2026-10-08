import type { DenialReason } from '../models/authorize';
import type { ActorId, TenantId } from '../models/ids';
import type { Permission } from '../models/permission';
import type { AuthRateLimitAction } from '../models/rate-limit';

/**
 * Security-relevant facts worth keeping. Every variant is free of secrets:
 * no emails, tokens, passwords or reset links, only stable identifiers and
 * error codes. Adding a variant forces the sink's severity table to be
 * updated (it is `satisfies Record<SecurityEvent['type'], ...>`).
 */
export type SecurityEvent =
  | {
      readonly type: 'authorization.denied';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly permission: Permission;
      readonly reason: DenialReason;
    }
  | {
      readonly type: 'authentication.sign_in_failed';
      readonly errorCode: string;
    }
  | {
      readonly type: 'authentication.rate_limited';
      readonly action: AuthRateLimitAction;
    }
  | {
      readonly type: 'authentication.session_created';
      readonly actorId: ActorId;
    }
  | {
      readonly type: 'authentication.session_revoked';
      readonly actorId: ActorId;
    }
  | {
      readonly type: 'authentication.account_created';
      readonly actorId: ActorId;
    }
  | {
      readonly type: 'authentication.password_reset_completed';
      readonly actorId: ActorId;
    };

/**
 * Append-only security trail. `record` is synchronous and MUST NOT throw or
 * block: auditing can never be the reason a request fails or slows down.
 * Today's adapter writes structured logs; a durable store can replace it
 * without touching any caller.
 */
export interface SecurityAuditLog {
  record(event: SecurityEvent): void;
}
