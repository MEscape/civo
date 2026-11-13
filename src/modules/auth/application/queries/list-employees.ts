import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MAX_EMPLOYEES_LISTED } from '../auth-limits';
import { findAccountsByIds } from '../services/find-account';
import { loadAuthorizedWebsite } from '../services/load-authorized-user-management';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { EmployeeListing } from '../contracts/user-views';
import type { ScopeError } from '../services/load-authorized-user-management';

/**
 * The members of the named website who hold the role `employee`, by name, for the people who
 * set up the bookings team (`booking.configure`) to give each a calendar. Only names, never e-mail
 * addresses. The roster comes from the memberships (the tenant boundary), the names from the
 * directory.
 */
export class ListEmployees {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<EmployeeListing, ScopeError | InfrastructureAppError> {
    const { members, directory } = this.deps;

    return loadAuthorizedWebsite(this.deps, {
      permission: 'booking.configure',
      tenantId: rawWebsiteId,
    }).andThen(({ tenantId }) =>
      members.listMembers(tenantId, { role: 'employee' }).andThen((roster) => {
        const ids = [...roster.members.keys()];
        if (ids.length === 0) {
          return okAsync<EmployeeListing>({ employees: [], isTruncated: roster.isTruncated });
        }
        return findAccountsByIds(directory, ids, MAX_EMPLOYEES_LISTED).map(
          (found): EmployeeListing => ({
            employees: found.items.map(({ id, name }) => ({ id, name })),
            // The first MAX_EMPLOYEES_LISTED by name; a bigger team is reported, not cut silently.
            isTruncated: roster.isTruncated || found.total > found.items.length,
          }),
        );
      }),
    );
  }
}
