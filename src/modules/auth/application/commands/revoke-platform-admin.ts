import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { lastAdmin, userNotFound } from '../../domain/errors/auth-errors';
import { parseActorId } from '../../domain/models/ids';

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
    const { authorization, members, audit } = this.deps;

    return authorization.requireInTenant('platform.admin.manage').andThen((actor) => {
      const subject = parseActorId(rawUserId);
      if (subject.isErr()) {
        return errAsync(userNotFound());
      }
      if (subject.value === actor.id) {
        return errAsync(lastAdmin());
      }
      return members.setPlatformAdmin(subject.value, false).map(() => {
        audit.record({
          type: 'platform_admin.revoked',
          actorId: actor.id,
          subjectId: subject.value,
        });
        return undefined;
      });
    });
  }
}
