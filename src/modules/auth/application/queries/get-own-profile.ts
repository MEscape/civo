import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedOwnProfile } from '../services/load-authorized-own-profile';

import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AuthorizationError } from '../authorization-service';
import type { ProfileView } from '../contracts/profile-views';
import type { ProfileDependencies } from '../profile-dependencies';

/** Reads only the caller's account, including when no website membership exists. */
export class GetOwnProfile {
  constructor(private readonly deps: ProfileDependencies) {}

  execute(): AppResultAsync<ProfileView, AuthorizationError | AuthenticatorError> {
    return loadAuthorizedOwnProfile(this.deps).map(({ profile }) => profile);
  }
}
