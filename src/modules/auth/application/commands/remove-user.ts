import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { lastAdmin, userNotFound } from '../../domain/errors/auth-errors';
import { parseActorId } from '../../domain/models/ids';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

export type RemoveUserError =
  AuthorizationError | InfrastructureAppError | NotFoundAppError | ConflictAppError;

/**
 * Takes a member out of the actor's tenant. The account itself stays (it may
 * belong to other tenants); it simply holds no role here any more. You
 * cannot remove yourself, and the last administrator stays.
 */
export class RemoveUser {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(rawUserId: string): AppResultAsync<undefined, RemoveUserError> {
    const { authorization, members, audit } = this.deps;

    return authorization.requireInTenant('user.manage').andThen((actor) => {
      const userId = parseActorId(rawUserId);
      if (userId.isErr()) {
        return errAsync(userNotFound());
      }
      const subject = userId.value;
      if (actor.id === subject) {
        return errAsync(lastAdmin());
      }

      return members
        .findRoles(subject, actor.tenantId)
        .andThen((current): AppResultAsync<undefined, RemoveUserError> => {
          if (current.length === 0) {
            return errAsync(userNotFound());
          }
          return members
            .removeMemberKeepingAdministrator(subject, actor.tenantId)
            .andThen((isRemoved): AppResultAsync<undefined, RemoveUserError> => {
              if (!isRemoved) {
                return errAsync(lastAdmin());
              }
              audit.record({
                type: 'membership.removed',
                actorId: actor.id,
                tenantId: actor.tenantId,
                subjectId: subject,
              });
              return okAsync(undefined);
            });
        });
    });
  }
}
