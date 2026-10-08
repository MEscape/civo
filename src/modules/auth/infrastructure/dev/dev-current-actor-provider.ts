import { logger } from '@lib/logger';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { invariant, isValidUrl } from '@lib/utils';

import { toActorId } from '../../domain/models/ids';

import type { Actor } from '../../domain/models/actor';
import type { TenantId } from '../../domain/models/ids';
import type { Role } from '../../domain/models/role';
import type {
  CurrentActorError,
  CurrentActorProvider,
} from '../../domain/ports/current-actor-provider.port';

/** Clearly not a real id, so a leaked dev actor is obvious in logs and data. */
const DEV_ACTOR_ID = 'dev-actor-not-a-real-user';

const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

const devLogger = logger.withContext({ module: 'auth.dev-actor' });

/**
 * True only for an app URL that points at this machine. NODE_ENV alone is
 * not enough: a staging or internal host started with NODE_ENV=development
 * would otherwise make every visitor the dev actor. An unparsable URL is
 * not provably local, so it is refused.
 */
function isLoopbackUrl(appUrl: string): boolean {
  if (!isValidUrl(appUrl)) {
    return false;
  }
  const { hostname } = new URL(appUrl);
  return LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost');
}

/**
 * The actor used when `AUTH_ENABLED=false`.
 *
 * This replaces WHO is acting, not WHETHER authorization runs: the actor
 * still carries a real role and every use case still calls
 * `authorization.require*(...)`. There is no branch anywhere that returns
 * "allowed" because auth is off, so a viewer-role dev actor is still
 * denied `website.delete`. That keeps disabled mode testable and prevents
 * it from becoming a bypass.
 *
 * It is never constructed from a request, header or cookie: the role and
 * tenant are fixed at construction by the composition root.
 */
export class DevCurrentActorProvider implements CurrentActorProvider {
  private readonly actor: Actor;

  constructor(options: {
    readonly role: Role;
    readonly tenantId: TenantId;
    readonly nodeEnv: string;
    readonly appUrl: string;
  }) {
    // Independent of the env schema on purpose: if that check is removed or
    // bypassed by a wiring mistake, constructing this class still fails.
    invariant(
      options.nodeEnv !== 'production',
      'DevCurrentActorProvider must never be constructed in production.',
    );
    invariant(
      isLoopbackUrl(options.appUrl),
      'DevCurrentActorProvider may only run when the app URL is a loopback address.',
    );
    this.actor = {
      id: toActorId(DEV_ACTOR_ID),
      tenantId: options.tenantId,
      roles: [options.role],
    };
    // Loud on purpose: every request is now this actor.
    devLogger.warn('auth.disabled_dev_actor_active', { role: options.role });
  }

  getCurrentActor(): AppResultAsync<Actor, CurrentActorError> {
    return okAsync(this.actor);
  }
}
