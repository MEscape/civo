import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { normalizeEmail } from '../../domain/models/credentials';

import type { DirectoryUser } from '../../domain/ports/user-directory.port';
import type { UserAdministrationDependencies } from '../auth-dependencies';

/** Whether the operator's configuration names this account, by its verified address, a platform administrator. */
export function isConfiguredPlatformAdmin(
  configuredEmails: ReadonlySet<string> | undefined,
  account: Pick<DirectoryUser, 'email' | 'emailVerified'>,
): boolean {
  return account.emailVerified && configuredEmails?.has(normalizeEmail(account.email)) === true;
}

/** One account's platform role, by membership or by verified operator configuration, without reading the whole list. */
export function isPlatformAdministrator(
  deps: Pick<UserAdministrationDependencies, 'members' | 'bootstrapAdminEmails'>,
  account: DirectoryUser,
): AppResultAsync<boolean, InfrastructureAppError> {
  if (isConfiguredPlatformAdmin(deps.bootstrapAdminEmails, account)) {
    return okAsync(true);
  }
  return deps.members.isPlatformAdmin(account.id);
}
