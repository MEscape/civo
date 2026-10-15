import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MAX_RESOLVED_NAMES } from '../auth-limits';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { MemberNameView } from '../contracts/user-views';

/**
 * The names of some members of the actor's own tenant, so a screen can say
 * who did something ("published by Anna Müller") from the actor id it keeps.
 * Anyone who can read the website may ask; only names are returned, never
 * e-mail addresses, and an id that is not a member of this tenant (a person
 * who left, or one of another tenant) yields nothing.
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
      return members.listMembers(actor.tenantId, { role: null }).andThen((roster) => {
        // The roster is the tenant boundary: only ids it knows are looked up.
        const ids = [...roster.members.keys()].filter((id) => wanted.has(id));
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
