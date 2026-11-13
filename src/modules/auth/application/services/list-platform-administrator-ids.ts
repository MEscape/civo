import type { InfrastructureAppError } from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { normalizeEmail } from '../../domain/models/credentials';
import { MAX_PLATFORM_ADMINS_LISTED } from '../auth-limits';

import type { ActorId } from '../../domain/models/ids';
import type { UserAdministrationDependencies } from '../auth-dependencies';

export interface PlatformAdministrators {
  readonly ids: readonly ActorId[];
  /** True when more stored administrators exist than one listing reads. */
  readonly isTruncated: boolean;
}

/** Stored roles and verified operator-configured accounts share one platform role indicator and filter. */
export function listPlatformAdministratorIds(
  deps: Pick<UserAdministrationDependencies, 'members' | 'directory' | 'bootstrapAdminEmails'>,
): AppResultAsync<PlatformAdministrators, InfrastructureAppError> {
  return ResultAsync.combine([
    deps.members.listPlatformAdmins(MAX_PLATFORM_ADMINS_LISTED),
    ResultAsync.combine(
      [...(deps.bootstrapAdminEmails ?? [])].map((email) =>
        deps.directory.findByEmail(normalizeEmail(email)),
      ),
    ),
  ] as const).map(([stored, configured]): PlatformAdministrators => ({
    ids: unique([
      ...stored.ids,
      ...configured.flatMap((user) => (user?.emailVerified === true ? [user.id] : [])),
    ]),
    isTruncated: stored.isTruncated,
  }));
}
