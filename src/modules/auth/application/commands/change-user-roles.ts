import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { lastAdmin, userNotFound } from '../../domain/errors/auth-errors';
import { parseActorId } from '../../domain/models/ids';
import { createRoleSet } from '../../domain/models/role-set';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

export type ChangeUserRolesError =
  | AuthorizationError
  | InfrastructureAppError
  | NotFoundAppError
  | ConflictAppError
  | ValidationAppError;

export interface ChangeUserRolesInput {
  readonly userId: string;
  readonly roles: readonly string[];
}

/**
 * Sets the complete role set of a member of the actor's own tenant. Two
 * guards keep a tenant administrable: you cannot change your own roles
 * (a mistake there locks you out, and a second administrator can do it),
 * and the last administrator keeps the role.
 */
export class ChangeUserRoles {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(input: ChangeUserRolesInput): AppResultAsync<undefined, ChangeUserRolesError> {
    const { authorization, members, audit } = this.deps;

    return authorization.requireInTenant('user.manage').andThen((actor) => {
      const roles = createRoleSet(input.roles);
      const userId = parseActorId(input.userId);
      if (roles.isErr()) {
        return errAsync(roles.error);
      }
      if (userId.isErr()) {
        return errAsync(userNotFound());
      }
      const wanted = roles.value;
      const subject = userId.value;
      if (actor.id === subject) {
        return errAsync(lastAdmin());
      }

      return members
        .findRoles(subject, actor.tenantId)
        .andThen((current): AppResultAsync<undefined, ChangeUserRolesError> => {
          if (current.length === 0) {
            return errAsync(userNotFound());
          }
          return members
            .replaceRolesKeepingAdministrator(subject, actor.tenantId, wanted)
            .andThen((isChanged): AppResultAsync<undefined, ChangeUserRolesError> => {
              if (!isChanged) {
                return errAsync(lastAdmin());
              }
              audit.record({
                type: 'membership.roles_changed',
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
