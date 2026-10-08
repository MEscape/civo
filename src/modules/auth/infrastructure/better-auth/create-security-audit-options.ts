import { createAuthMiddleware, isAPIError } from 'better-auth/api';

import { providerFailed } from '../../domain/errors/auth-errors';
import { toActorId } from '../../domain/models/ids';

import { mapBetterAuthError } from './map-better-auth-error';

import type { SecurityAuditLog } from '../../domain/ports/security-audit-log.port';
import type { BetterAuthOptions } from 'better-auth';

const SIGN_IN_PATH_PREFIX = '/sign-in';

/**
 * Feeds the security audit log from Better Auth's lifecycle. These hooks
 * fire for BOTH the HTTP handler and direct `auth.api.*` calls from Server
 * Actions, so nothing here depends on which entry point was used.
 *
 * Only ids and our own error codes are recorded: never the email (PII, and
 * an enumeration aid in logs), never a token, never the provider's message.
 * A hook that throws would break the sign-in it observes, so `record` is
 * the port's non-throwing call and nothing else happens here.
 */
export function createSecurityAuditOptions(
  audit: SecurityAuditLog,
): Pick<BetterAuthOptions, 'databaseHooks' | 'hooks'> {
  return {
    databaseHooks: {
      user: {
        create: {
          after: (user) => {
            audit.record({
              type: 'authentication.account_created',
              actorId: toActorId(user.id),
            });
            return Promise.resolve();
          },
        },
      },
      session: {
        create: {
          after: (session) => {
            audit.record({
              type: 'authentication.session_created',
              actorId: toActorId(session.userId),
            });
            return Promise.resolve();
          },
        },
        delete: {
          after: (session) => {
            audit.record({
              type: 'authentication.session_revoked',
              actorId: toActorId(session.userId),
            });
            return Promise.resolve();
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware((ctx) => {
        if (!ctx.path.startsWith(SIGN_IN_PATH_PREFIX)) {
          return Promise.resolve();
        }
        const returned: unknown = ctx.context.returned;
        if (!isAPIError(returned)) {
          return Promise.resolve();
        }
        audit.record({
          type: 'authentication.sign_in_failed',
          errorCode: mapBetterAuthError(returned, providerFailed).code,
        });
        return Promise.resolve();
      }),
    },
  };
}
