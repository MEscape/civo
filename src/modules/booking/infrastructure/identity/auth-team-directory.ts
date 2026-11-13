import { getAuthQueries, isAuthEnabled, toActorId } from '@modules/auth';

import { okAsync } from '@lib/result';

import type { TeamDirectory } from '../../domain/ports/team-directory.port';

/**
 * The employees of the named website, from the auth module's member directory. Without sign-in
 * there are no accounts, so nobody can be set up and the calendars show the names they keep.
 */
export const authTeamDirectory: TeamDirectory = {
  listEmployees: (websiteId) =>
    isAuthEnabled
      ? getAuthQueries()
          .listEmployees.execute(websiteId)
          .map(({ employees, isTruncated }) => ({
            members: employees.map(({ id, name }) => ({ id: toActorId(id), name })),
            isTruncated,
          }))
      : okAsync({ members: [], isTruncated: false }),
};
