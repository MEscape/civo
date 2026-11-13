import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { permissionDenied, userNotFound } from '../../domain/errors/auth-errors';
import { parseActorId } from '../../domain/models/ids';
import { findAccount } from '../services/find-account';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

export type GrantPlatformAdminError =
  AuthorizationError | InfrastructureAppError | NotFoundAppError | ConflictAppError;

/**
 * Makes an existing account a platform administrator. Only a platform
 * administrator may, only for an account that exists and has a verified
 * address (the same bar as the deployment's list), and the change is audited.
 * An unknown or unverified account answers "not found". Addresses without an
 * account are invited instead (`InviteUser` with the platform scope).
 */
export class GrantPlatformAdmin {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(rawUserId: string): AppResultAsync<undefined, GrantPlatformAdminError> {
    const { authorization, members, directory, audit } = this.deps;

    return authorization.requireInTenant('platform.admin.manage').andThen((actor) => {
      const subject = parseActorId(rawUserId);
      if (subject.isErr()) {
        return errAsync(userNotFound());
      }
      return findAccount(directory, subject.value).andThen((account) => {
        if (!account?.emailVerified) {
          return errAsync(userNotFound());
        }
        return members
          .grantPlatformAdmin(account.id, { actor, subjectEmail: account.email })
          .andThen((isGranted) => {
            if (!isGranted) {
              return errAsync(permissionDenied());
            }
            audit.record({
              type: 'platform_admin.granted',
              actorId: actor.id,
              subjectId: account.id,
            });
            return okAsync(undefined);
          });
      });
    });
  }
}
