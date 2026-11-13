import type { InfrastructureAppError } from '@lib/errors';
import { ResultAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { toActorId } from '../../domain/models/ids';
import { MAX_RESOLVED_NAMES } from '../auth-limits';
import { findAccountsByIds } from '../services/find-account';
import { listPlatformAdministratorIds } from '../services/list-platform-administrator-ids';

import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { MemberNameListing, MemberNameView } from '../contracts/user-views';

/**
 * The names of some members of the actor's own tenant, so a screen can say
 * who did something ("published by Anna Müller") from the actor id it keeps.
 * Anyone who can read the website may ask; only names are returned, never
 * e-mail addresses. The tenant's members are named, and so are the platform
 * administrators (stored or named by the deployment's configuration), who act
 * in every website without being its member; for a platform administrator any
 * account is named, since the platform's trail spans every website. For anyone
 * else, any other id (a person who left, or one of another tenant) yields nothing.
 */
export class ResolveMemberNames {
  constructor(private readonly deps: UserAdministrationDependencies) {}

  execute(
    rawIds: readonly string[],
  ): AppResultAsync<MemberNameListing, AuthorizationError | InfrastructureAppError> {
    const { members, directory, authorization } = this.deps;
    const requested = new Set(rawIds);
    const wanted = new Set([...requested].slice(0, MAX_RESOLVED_NAMES));
    const isOverCap = requested.size > wanted.size;

    return authorization.requireInTenant('website.read').andThen((actor) => {
      if (wanted.size === 0) {
        return okAsync<MemberNameListing>({ names: [], isTruncated: false });
      }
      return ResultAsync.combine([
        members.listMembers(actor.tenantId, { role: null }),
        listPlatformAdministratorIds(this.deps),
      ] as const).andThen(([roster, platformAdmins]) => {
        const isTruncated = isOverCap || roster.isTruncated || platformAdmins.isTruncated;
        // The roster and the platform's administrators are the boundary: only ids they know are looked up.
        // A platform administrator works across websites (the trail of all of them), so for them the
        // boundary is the account itself: a person who acted in another website is named, not "former".
        const known = new Set([...roster.members.keys(), ...platformAdmins.ids]);
        const ids =
          actor.platformAuthority === undefined
            ? [...known].filter((id) => wanted.has(id))
            : [...wanted].map(toActorId);
        if (ids.length === 0) {
          return okAsync<MemberNameListing>({ names: [], isTruncated });
        }
        return findAccountsByIds(directory, ids, MAX_RESOLVED_NAMES).map(
          (found): MemberNameListing => ({
            names: found.items.map((user): MemberNameView => ({ id: user.id, name: user.name })),
            isTruncated,
          }),
        );
      });
    });
  }
}
