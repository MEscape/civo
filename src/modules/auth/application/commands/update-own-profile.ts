import type { InfrastructureAppError, RateLimitedAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/auth-errors';
import { createProfileDraft } from '../../domain/models/profile';
import { AUTH_RATE_LIMITS } from '../rate-limits';
import { loadAuthorizedOwnProfile } from '../services/load-authorized-own-profile';

import type { ActorId } from '../../domain/models/ids';
import type { ProfileDraft } from '../../domain/models/profile';
import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AuthorizationError } from '../authorization-service';
import type { ProfileDependencies } from '../profile-dependencies';

/** Updates only the authenticated account. Neither roles nor email can be changed through this input. */
export class UpdateOwnProfile {
  constructor(private readonly deps: ProfileDependencies) {}

  execute(
    input: ProfileDraft,
  ): AppResultAsync<void, AuthorizationError | AuthenticatorError | RateLimitedAppError> {
    return loadAuthorizedOwnProfile(this.deps).andThen(({ actor, profile }) =>
      createProfileDraft(input).asyncAndThen((draft) =>
        this.deps.rateLimiter
          .enforce({
            policy: AUTH_RATE_LIMITS.updateProfile,
            subject: { kind: 'actor', tenantId: 'account', actorId: actor.id },
          })
          .mapErr(fromRateLimitFailure)
          .andThen(() => this.save(actor.id, profile.image, draft)),
      ),
    );
  }

  private save(
    actorId: ActorId,
    previousImage: string | null,
    draft: ProfileDraft,
  ): AppResultAsync<void, AuthenticatorError> {
    const uploaded: AppResultAsync<string | null | undefined, InfrastructureAppError> = draft.image
      ? this.deps.images.upload(actorId, draft.image)
      : okAsync(draft.image);
    return uploaded.andThen((image) =>
      this.deps.account
        .update(actorId, {
          name: draft.name,
          ...(image === undefined ? {} : { image }),
        })
        .orElse((error) =>
          typeof image === 'string'
            ? this.deps.images
                .remove(actorId, image)
                .orElse(() => okAsync(undefined))
                .andThen(() => errAsync(error))
            : errAsync(error),
        )
        .andThen(() => {
          this.deps.audit.record({ type: 'authentication.profile_updated', actorId });
          // Once the provider committed, cleanup failure must not report a failed save.
          return image !== undefined && previousImage !== null
            ? this.deps.images.remove(actorId, previousImage).orElse(() => okAsync(undefined))
            : okAsync(undefined);
        }),
    );
  }
}
