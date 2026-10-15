import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { userNotFound } from '../../domain/errors/auth-errors';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';

export type GrantPlatformAdminError =
  AuthorizationError | InfrastructureAppError | NotFoundAppError | ConflictAppError;

/**
 * Makes an existing account a platform administrator. Only a platform
 * administrator may, only for an account that exists and has a verified
 * address (the same bar as the deployment's list), and the change is audited.
 * An unknown address answers "not found": nobody is invited to the platform.
 */
export class GrantPlatformAdmin {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(email: string): AppResultAsync<undefined, GrantPlatformAdminError> {
    const { authorization, members, directory, audit } = this.deps;

    return authorization.requireInTenant('platform.admin.manage').andThen((actor) =>
      directory.findByEmail(email.trim().toLowerCase()).andThen((user) => {
        if (!user?.emailVerified) {
          return errAsync(userNotFound());
        }
        return members.setPlatformAdmin(user.id, true).map(() => {
          audit.record({ type: 'platform_admin.granted', actorId: actor.id, subjectId: user.id });
          return undefined;
        });
      }),
    );
  }
}
