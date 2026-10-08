import type { Clock } from '@lib/clock';
import { matchAppError } from '@lib/errors';
import type { AppError } from '@lib/errors';
import { errAsync, fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  sessionExpired,
  sessionLookupFailed,
  unauthenticated,
} from '../../domain/errors/auth-errors';
import { toActorId } from '../../domain/models/ids';
import { hasExceededMaxLifetime } from '../../domain/models/session-policy';

import { mapBetterAuthError } from './map-better-auth-error';

import type { SessionSnapshot, SessionSource } from './better-auth-session-source';
import type { Actor } from '../../domain/models/actor';
import type { TenantId } from '../../domain/models/ids';
import type {
  CurrentActorError,
  CurrentActorProvider,
} from '../../domain/ports/current-actor-provider.port';
import type { MembershipRepository } from '../../domain/ports/membership.repository';

export interface BetterAuthCurrentActorProviderDeps {
  readonly sessions: SessionSource;
  readonly memberships: MembershipRepository;
  /** Supplies the incoming request headers. Injected because `next/headers` is a framework import. */
  readonly getHeaders: () => Promise<Headers>;
  readonly sessionMaxLifetimeMs: number;
  readonly clock: Clock;
  /**
   * The tenant every actor is resolved in until real multi-tenancy ships.
   * It comes from our side (configuration), never from the session or the request.
   */
  readonly tenantId: TenantId;
}

export class BetterAuthCurrentActorProvider implements CurrentActorProvider {
  constructor(private readonly deps: BetterAuthCurrentActorProviderDeps) {}

  getCurrentActor(): AppResultAsync<Actor, CurrentActorError> {
    // `fromThrowableAsync` also catches a synchronous throw from `getHeaders`.
    return fromThrowableAsync(
      async () =>
        this.deps.sessions.getSession({
          headers: await this.deps.getHeaders(),
        }),
      (thrown) => narrowSessionLookupError(mapBetterAuthError(thrown, sessionLookupFailed)),
    ).andThen((session) => this.resolveActor(session));
  }

  private resolveActor(session: SessionSnapshot | null): AppResultAsync<Actor, CurrentActorError> {
    // No session is the normal "not signed in" outcome, not a failure of the provider.
    if (session === null) {
      return errAsync(unauthenticated());
    }

    const isTooOld = hasExceededMaxLifetime(
      session.session.createdAt,
      this.deps.clock.now(),
      this.deps.sessionMaxLifetimeMs,
    );
    if (isTooOld) {
      return errAsync(sessionExpired());
    }

    const actorId = toActorId(session.user.id);
    const { tenantId } = this.deps;

    // No roles is a valid state: the actor is authenticated but holds nothing in
    // this tenant, so authorization denies every permission. It must not be an error here.
    return this.deps.memberships
      .findRoles(actorId, tenantId)
      .map((roles) => ({ id: actorId, tenantId, roles }));
  }
}

/**
 * The port only allows unauthorized or infrastructure failures from a
 * session lookup. `mapBetterAuthError` can produce other kinds (a conflict
 * or validation error is meaningless for reading a session), and returning
 * one would break the port's contract. Anything outside the contract is
 * collapsed to an infrastructure error, which fails closed. The exhaustive
 * match forces a decision if `AppError` ever gains a kind.
 */
function narrowSessionLookupError(error: AppError): CurrentActorError {
  const failClosed = (cause: AppError): CurrentActorError => sessionLookupFailed(cause);

  return matchAppError<CurrentActorError>(error, {
    unauthorized: (allowed) => allowed,
    infrastructure: (allowed) => allowed,
    validation: failClosed,
    not_found: failClosed,
    conflict: failClosed,
    forbidden: failClosed,
    unexpected: failClosed,
  });
}
