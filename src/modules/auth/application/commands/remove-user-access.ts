import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { lastAdmin } from '../../domain/errors/auth-errors';
import { resolveAccessTarget } from '../services/resolve-access-target';

import type { PlatformAccessDependencies } from '../auth-dependencies';
import type { SetUserAccessError } from './set-user-access';

export interface RemoveUserAccessInput {
  readonly userId: string;
  readonly tenantId: string;
}

/** Takes a person's access to a website away, from outside it; the website's last administrator cannot be removed. */
export class RemoveUserAccess {
  constructor(private readonly deps: PlatformAccessDependencies) {}

  execute(input: RemoveUserAccessInput): AppResultAsync<undefined, SetUserAccessError> {
    const { authorization, members, audit } = this.deps;

    return authorization.requireInTenant('platform.admin.manage').andThen((actor) =>
      resolveAccessTarget(this.deps, input).andThen(({ subject, tenantId }) =>
        members
          .removeMemberKeepingAdministrator(subject, tenantId)
          .andThen((isRemoved): AppResultAsync<undefined, SetUserAccessError> => {
            if (!isRemoved) {
              return errAsync(lastAdmin());
            }
            audit.record({
              type: 'membership.removed',
              actorId: actor.id,
              tenantId,
              subjectId: subject,
            });
            return okAsync(undefined);
          }),
      ),
    );
  }
}
