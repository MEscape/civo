import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MAX_EMPLOYEES_LISTED } from '../auth-limits';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { EmployeeView } from '../contracts/user-views';

/**
 * The people of the actor's tenant who hold the employee role, by name: who a
 * resource can be assigned to. It carries no email addresses and needs only
 * `employee.read`, which editors hold, so assigning a calendar does not mean
 * seeing every account.
 */
export class ListEmployees {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(): AppResultAsync<readonly EmployeeView[], AuthorizationError | InfrastructureAppError> {
    const { authorization, members, directory } = this.deps;

    return authorization.requireInTenant('employee.read').andThen((actor) =>
      members.listMembers(actor.tenantId, { role: 'employee' }).andThen((roster) => {
        const ids = [...roster.members.keys()];
        if (ids.length === 0) {
          return okAsync<readonly EmployeeView[]>([]);
        }
        return directory
          .search({
            ids,
            text: null,
            sort: { field: 'name', direction: 'asc' },
            page: { page: 1, pageSize: MAX_EMPLOYEES_LISTED },
          })
          .map((found) =>
            found.items.map((user): EmployeeView => ({ id: user.id, name: user.name })),
          );
      }),
    );
  }
}
