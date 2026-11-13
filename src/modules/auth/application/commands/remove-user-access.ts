import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedManagedWebsite } from '../services/load-authorized-user-management';
import { accessWriteRefused, resolveAccessChange } from '../services/resolve-access-target';

import type { PlatformAccessDependencies } from '../auth-dependencies';
import type { AccessTargetError } from '../services/resolve-access-target';

export interface RemoveUserAccessInput {
  readonly userId: string;
  readonly tenantId: string;
  readonly expectedRoles?: readonly string[] | undefined;
}

/** Takes a person's access to a website away, from outside it; the website's last administrator cannot be removed. */
export class RemoveUserAccess {
  constructor(private readonly deps: PlatformAccessDependencies) {}

  execute(input: RemoveUserAccessInput): AppResultAsync<undefined, AccessTargetError> {
    const { members, audit } = this.deps;

    return loadAuthorizedManagedWebsite(this.deps, input.tenantId).andThen((website) => {
      const { actor, tenantId } = website;
      return resolveAccessChange(this.deps, website, input).andThen(({ subject, options }) =>
        members
          .removeMemberKeepingAdministrator(subject, tenantId, options)
          .andThen((isRemoved): AppResultAsync<undefined, AccessTargetError> => {
            if (!isRemoved) {
              return errAsync(accessWriteRefused(input.expectedRoles));
            }
            audit.record({
              type: 'membership.removed',
              actorId: actor.id,
              tenantId,
              subjectId: subject,
              removedRoles: options.expectedRoles,
            });
            return okAsync(undefined);
          }),
      );
    });
  }
}
