import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { tenantInvalid } from '../../domain/errors/auth-errors';
import {
  createInvitationOffer,
  createPlatformInvitationOffer,
} from '../../domain/models/invitation';

import {
  loadAuthorizedManagedWebsite,
  loadAuthorizedPlatform,
} from './load-authorized-user-management';

import type { ScopeError } from './load-authorized-user-management';
import type { Actor } from '../../domain/models/actor';
import type { TenantId } from '../../domain/models/ids';
import type { InvitationRole } from '../../domain/models/invitation';
import type { InviteUserDependencies } from '../auth-dependencies';
import type { InviteUserInput } from '../contracts/auth-inputs';

/** An authorized actor and the one scope, address and role the request offers. */
export interface InvitationTarget {
  readonly actor: Actor;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly role: InvitationRole;
}

/** An explicit target chooses the permission; request fields can never select broader authority. */
export function loadAuthorizedInvitationTarget(
  deps: InviteUserDependencies,
  input: InviteUserInput,
): AppResultAsync<InvitationTarget, ScopeError> {
  const { scope } = input;
  if (scope.kind === 'platform') {
    return loadAuthorizedPlatform(deps).andThen(
      ({ actor, tenantId }): AppResultAsync<InvitationTarget, ScopeError> => {
        const offer = createPlatformInvitationOffer(input.email);
        return offer.isErr() ? errAsync(offer.error) : okAsync({ actor, tenantId, ...offer.value });
      },
    );
  }
  return loadAuthorizedManagedWebsite(deps, scope.tenantId).andThen(
    ({ actor, tenantId }): AppResultAsync<InvitationTarget, ScopeError> => {
      const offer = createInvitationOffer({ email: input.email, role: scope.role });
      if (offer.isErr()) {
        return errAsync(offer.error);
      }
      return deps.tenants
        .exists(tenantId)
        .andThen((exists) =>
          exists ? okAsync({ actor, tenantId, ...offer.value }) : errAsync(tenantInvalid()),
        );
    },
  );
}
