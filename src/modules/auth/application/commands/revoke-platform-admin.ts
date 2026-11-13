import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  cannotRevokeSelf,
  permissionDenied,
  platformRoleConfigured,
  userNotFound,
} from '../../domain/errors/auth-errors';
import { parseActorId } from '../../domain/models/ids';
import { findAccount } from '../services/find-account';
import { isConfiguredPlatformAdmin } from '../services/is-platform-administrator';

import type { Actor } from '../../domain/models/actor';
import type { DirectoryUser } from '../../domain/ports/user-directory.port';
import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

export type RevokePlatformAdminError =
  AuthorizationError | InfrastructureAppError | NotFoundAppError | ConflictAppError;

/**
 * Takes the platform role away. Nobody revokes themselves (that could leave
 * the platform without a way in short of editing configuration), and the
 * change is audited.
 */
export class RevokePlatformAdmin {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(rawUserId: string): AppResultAsync<undefined, RevokePlatformAdminError> {
    const { authorization, directory, bootstrapAdminEmails } = this.deps;

    return authorization
      .requireInTenant('platform.admin.manage')
      .andThen((actor): AppResultAsync<undefined, RevokePlatformAdminError> => {
        const subject = parseActorId(rawUserId);
        if (subject.isErr()) {
          return errAsync(userNotFound());
        }
        if (subject.value === actor.id) {
          return errAsync(cannotRevokeSelf());
        }
        return findAccount(directory, subject.value).andThen(
          (account): AppResultAsync<undefined, RevokePlatformAdminError> => {
            if (account === null) {
              return errAsync(userNotFound());
            }
            if (isConfiguredPlatformAdmin(bootstrapAdminEmails, account)) {
              return errAsync(platformRoleConfigured());
            }
            return this.revoke(actor, account);
          },
        );
      });
  }

  private revoke(
    actor: Actor,
    account: DirectoryUser,
  ): AppResultAsync<undefined, RevokePlatformAdminError> {
    const { members, audit } = this.deps;

    return members.isPlatformAdmin(account.id).andThen((wasAdmin) =>
      members
        .revokePlatformAdmin(account.id, {
          actorId: actor.id,
          authority: actor.platformAuthority ?? 'membership',
          subjectEmail: account.email,
        })
        .andThen((isRevoked): AppResultAsync<undefined, RevokePlatformAdminError> => {
          if (!isRevoked) {
            return errAsync(permissionDenied());
          }
          // Idempotent: revoking someone who holds no platform membership changed nothing, so it is no event.
          if (wasAdmin) {
            audit.record({
              type: 'platform_admin.revoked',
              actorId: actor.id,
              subjectId: account.id,
            });
          }
          return okAsync(undefined);
        }),
    );
  }
}
