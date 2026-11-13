import type { AppResultAsync } from '@lib/result';

import type { Actor } from '../../domain/models/actor';
import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { OwnProfile } from '../../domain/ports/profile-account.port';
import type { AuthorizationError } from '../authorization-service';
import type { ProfileDependencies } from '../profile-dependencies';

/** Account ownership comes only from the authenticated actor, independent of website membership. */
export function loadAuthorizedOwnProfile(
  deps: Pick<ProfileDependencies, 'authorization' | 'account'>,
): AppResultAsync<
  { readonly actor: Actor; readonly profile: OwnProfile },
  AuthorizationError | AuthenticatorError
> {
  return deps.authorization
    .requireActor()
    .andThen((actor) => deps.account.read(actor.id).map((profile) => ({ actor, profile })));
}
