import type { DenialReason } from '../models/authorize';
import type { ActorId, InvitationId, TenantId } from '../models/ids';
import type { InvitationRole } from '../models/invitation';
import type { Permission } from '../models/permission';
import type { TenantRole } from '../models/role';

/**
 * Security-relevant facts worth keeping. Every variant is free of secrets:
 * no emails, tokens, passwords or reset links, only stable identifiers and
 * error codes. Adding a variant forces the sink's severity table to be
 * updated (it is `satisfies Record<SecurityEvent['type'], ...>`).
 */
export type SecurityEvent =
  | {
      readonly type: 'authentication.profile_updated';
      readonly actorId: ActorId;
    }
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
    }
  | {
      readonly type: 'membership.roles_changed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly subjectId: ActorId;
      /** The complete role set held afterwards. */
      readonly roles: readonly TenantRole[];
      /** The set held before, only when the write compared it under its lock. */
      readonly previousRoles?: readonly TenantRole[] | undefined;
    }
  | {
      readonly type: 'platform_admin.granted';
      readonly actorId: ActorId;
      readonly subjectId: ActorId;
    }
  | {
      readonly type: 'platform_admin.revoked';
      readonly actorId: ActorId;
      readonly subjectId: ActorId;
    }
  | {
      readonly type: 'membership.removed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly subjectId: ActorId;
      /** The roles taken away, only when the write compared them under its lock. */
      readonly removedRoles?: readonly TenantRole[] | undefined;
    }
  | {
      readonly type: 'invitation.created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly invitationId: InvitationId;
      readonly role: InvitationRole;
    }
  | {
      readonly type: 'invitation.accepted';
      readonly tenantId: TenantId;
      readonly invitationId: InvitationId;
      readonly subjectId: ActorId;
      readonly role: InvitationRole;
    }
  | {
      readonly type: 'invitation.revoked';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly invitationId: InvitationId;
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
