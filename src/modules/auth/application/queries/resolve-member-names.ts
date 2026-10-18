import type { InfrastructureAppError } from '@lib/errors';
import { ResultAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MAX_RESOLVED_NAMES } from '../auth-limits';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { MemberNameView } from '../contracts/user-views';

/**
 * The names of some members of the actor's own tenant, so a screen can say
 * who did something ("published by Anna Müller") from the actor id it keeps.
 * Anyone who can read the website may ask; only names are returned, never
 * e-mail addresses. The tenant's members are named, and so are the platform
 * administrators, who act in every website without being its member; any other
 * id (a person who left, or one of another tenant) yields nothing.
 */
export class ResolveMemberNames {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(
    rawIds: readonly string[],
  ): AppResultAsync<readonly MemberNameView[], AuthorizationError | InfrastructureAppError> {
    const { members, directory, authorization } = this.deps;
    const wanted = new Set(rawIds.slice(0, MAX_RESOLVED_NAMES));

    return authorization.requireInTenant('website.read').andThen((actor) => {
      if (wanted.size === 0) {
        return okAsync<readonly MemberNameView[]>([]);
      }
      return ResultAsync.combine([
        members.listMembers(actor.tenantId, { role: null }),
        members.listPlatformAdmins(),
      ] as const).andThen(([roster, platformAdmins]) => {
        // The roster and the platform's administrators are the boundary: only ids they know are looked up.
        const known = new Set([...roster.members.keys(), ...platformAdmins]);
        const ids = [...known].filter((id) => wanted.has(id));
        if (ids.length === 0) {
          return okAsync<readonly MemberNameView[]>([]);
        }
        return directory
          .search({
            ids,
            text: null,
            sort: { field: 'name', direction: 'asc' },
            page: { page: 1, pageSize: MAX_RESOLVED_NAMES },
          })
          .map((found) =>
            found.items.map((user): MemberNameView => ({ id: user.id, name: user.name })),
          );
      });
    });
  }
}
