import type { InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { providerFailed, unauthenticated } from '../../domain/errors/auth-errors';

import type { ActorId } from '../../domain/models/ids';
import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { OwnProfile, ProfileAccount } from '../../domain/ports/profile-account.port';

/** The two provider calls this adapter needs, without the provider's HTTP response overloads. */
interface ProfileApi {
  getSession(input: { readonly headers: Headers }): Promise<{
    readonly user: Omit<OwnProfile, 'image'> & {
      readonly id: string;
      readonly image?: string | null | undefined;
    };
  } | null>;
  updateUser(input: {
    readonly headers: Headers;
    readonly body: { readonly name: string; readonly image?: string | null };
  }): Promise<unknown>;
}

function profileProviderFailed(cause: unknown): InfrastructureAppError {
  logger.error('auth.profile_provider_failed', { code: 'auth.provider_failed' });
  return providerFailed(cause);
}

/** Better Auth remains the only writer to its account database. */
export class BetterAuthProfileAccount implements ProfileAccount {
  constructor(
    private readonly deps: {
      readonly getApi: () => ProfileApi;
      readonly getHeaders: () => Promise<Headers>;
    },
  ) {}

  read(actorId: ActorId): AppResultAsync<OwnProfile, AuthenticatorError> {
    return fromThrowableAsync(async () => {
      const session = await this.deps
        .getApi()
        .getSession({ headers: await this.deps.getHeaders() });
      return session?.user;
    }, profileProviderFailed).andThen((user) =>
      user?.id !== actorId
        ? errAsync(unauthenticated())
        : okAsync({
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            image: user.image ?? null,
            createdAt: user.createdAt,
          }),
    );
  }

  update(
    actorId: ActorId,
    draft: { readonly name: string; readonly image?: string | null },
  ): AppResultAsync<void, AuthenticatorError> {
    return this.read(actorId).andThen(() =>
      fromThrowableAsync(async () => {
        await this.deps.getApi().updateUser({ headers: await this.deps.getHeaders(), body: draft });
      }, profileProviderFailed),
    );
  }
}
