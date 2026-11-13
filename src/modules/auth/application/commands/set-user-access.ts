import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { createRoleSet } from '../../domain/models/role-set';
import { loadAuthorizedManagedWebsite } from '../services/load-authorized-user-management';
import { accessWriteRefused, resolveAccessChange } from '../services/resolve-access-target';

import type { PlatformAccessDependencies } from '../auth-dependencies';
import type { AccessTargetError } from '../services/resolve-access-target';

export type SetUserAccessError = AccessTargetError;

export interface SetUserAccessInput {
  readonly userId: string;
  readonly tenantId: string;
  /** The complete set the person holds in the website afterwards; at least one. */
  readonly roles: readonly string[];
  readonly expectedRoles?: readonly string[] | undefined;
}

/**
 * Gives a person access to a website, or changes it: the complete set of
 * roles they hold there. For the platform's administrators, from outside the
 * website. The last administrator of a website keeps the role; a platform
 * administrator may change their own access like anyone's. A person who is not yet
 * a member becomes one.
 */
export class SetUserAccess {
  constructor(private readonly deps: PlatformAccessDependencies) {}

  execute(input: SetUserAccessInput): AppResultAsync<undefined, SetUserAccessError> {
    const { members, audit } = this.deps;

    return loadAuthorizedManagedWebsite(this.deps, input.tenantId).andThen((website) => {
      const roles = createRoleSet(input.roles);
      if (roles.isErr()) {
        return errAsync(roles.error);
      }
      const { actor, tenantId } = website;
      return resolveAccessChange(this.deps, website, input).andThen(({ subject, options }) =>
        members
          .replaceRolesKeepingAdministrator(subject, tenantId, { ...options, roles: roles.value })
          .andThen((isChanged): AppResultAsync<undefined, SetUserAccessError> => {
            if (!isChanged) {
              return errAsync(accessWriteRefused(input.expectedRoles));
            }
            audit.record({
              type: 'membership.roles_changed',
              actorId: actor.id,
              tenantId,
              subjectId: subject,
              roles: roles.value,
              previousRoles: options.expectedRoles,
            });
            return okAsync(undefined);
          }),
      );
    });
  }
}
