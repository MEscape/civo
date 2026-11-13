import type { InfrastructureAppError } from '@lib/errors';
import type { Page } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { ActorId } from '../../domain/models/ids';
import type { DirectoryUser, UserDirectory } from '../../domain/ports/user-directory.port';

/** The accounts with these ids, by name, at most `limit` of them; `total` says how many exist. */
export function findAccountsByIds(
  directory: UserDirectory,
  ids: readonly ActorId[],
  limit: number,
): AppResultAsync<Page<DirectoryUser>, InfrastructureAppError> {
  return directory.search({
    ids,
    text: null,
    sort: { field: 'name', direction: 'asc' },
    page: { page: 1, pageSize: limit },
  });
}

/** The account with this id, or `null` when none exists. A store failure stays an error, never "no account". */
export function findAccount(
  directory: UserDirectory,
  id: ActorId,
): AppResultAsync<DirectoryUser | null, InfrastructureAppError> {
  return findAccountsByIds(directory, [id], 1).map((found) => found.items[0] ?? null);
}
