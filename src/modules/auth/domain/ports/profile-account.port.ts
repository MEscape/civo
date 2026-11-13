import type { AppResultAsync } from '@lib/result';

import type { AuthenticatorError } from './authenticator.port';
import type { ActorId } from '../models/ids';

export interface OwnProfile {
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly image: string | null;
  readonly createdAt: Date;
}

/** The provider always verifies the server session matches the authorized actor. */
export interface ProfileAccount {
  read(actorId: ActorId): AppResultAsync<OwnProfile, AuthenticatorError>;
  update(
    actorId: ActorId,
    draft: { readonly name: string; readonly image?: string | null },
  ): AppResultAsync<void, AuthenticatorError>;
}
