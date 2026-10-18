import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { lastAdmin } from '../../domain/errors/auth-errors';
import { createRoleSet } from '../../domain/models/role-set';
import { resolveAccessTarget } from '../services/resolve-access-target';

import type { PlatformAccessDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

export type SetUserAccessError =
  | AuthorizationError
  | ConflictAppError
  | InfrastructureAppError
  | NotFoundAppError
  | ValidationAppError;

export interface SetUserAccessInput {
  readonly userId: string;
  readonly tenantId: string;
  /** The complete set the person holds in the website afterwards; at least one. */
  readonly roles: readonly string[];
}

/**
 * Gives a person access to a website, or changes it: the complete set of
 * roles they hold there. For the platform's administrators, from outside the
 * website. The same guards as inside it: nobody changes their own access, and
 * the last administrator of a website keeps the role. A person who is not yet
 * a member becomes one.
 */
export class SetUserAccess {
  constructor(private readonly deps: PlatformAccessDependencies) {}

  execute(input: SetUserAccessInput): AppResultAsync<undefined, SetUserAccessError> {
    const { authorization, members, audit } = this.deps;

    return authorization.requireInTenant('platform.admin.manage').andThen((actor) => {
      const roles = createRoleSet(input.roles);
      if (roles.isErr()) {
        return errAsync(roles.error);
      }
      return resolveAccessTarget(this.deps, actor.id, input).andThen(({ subject, tenantId }) =>
        members.findRoles(subject, tenantId).andThen((current) => {
          const write =
            current.length === 0
              ? members.replaceRoles(subject, tenantId, roles.value).map(() => true)
              : members.replaceRolesKeepingAdministrator(subject, tenantId, roles.value);
          return write.andThen((isChanged): AppResultAsync<undefined, SetUserAccessError> => {
            if (!isChanged) {
              return errAsync(lastAdmin());
            }
            audit.record({
              type: 'membership.roles_changed',
              actorId: actor.id,
              tenantId,
              subjectId: subject,
            });
            return okAsync(undefined);
          });
        }),
      );
    });
  }
}
