import type { Clock } from '@lib/clock';
import type { ClientAddressSettings } from '@lib/config/server';

import { createClientAddressResolver } from './client-address';
import { createLogThrottle } from './rate-limit-log';

import type { HeaderReader, UnresolvedReason } from './client-address';
import type { RateLimitLog } from './rate-limit-log';
import type { RateLimitSubject } from './rate-limit-subject';

const DEFAULT_LOG_INTERVAL_MS = 10_000;

/** What a client-keyed limit is counted against: the resolved address, or "could not tell". */
export type ClientSubject = Extract<RateLimitSubject, { kind: 'client' | 'unresolved-client' }>;

/**
 * The port use cases receive to learn who is calling, like `CurrentActorProvider` does for
 * signed-in users. The address comes from trusted request metadata read at the boundary, never
 * from a form field or action argument, so a client cannot choose it.
 */
export interface ClientAddressProvider {
  /** Never rejects and never returns a guess: an address that cannot be trusted is `unresolved-client`. */
  current(): Promise<ClientSubject>;
}

export interface ClientAddressProviderDeps {
  /** Reads the current request's headers; rejects outside a request (`next/headers` does). */
  readonly getHeaders: () => Promise<HeaderReader>;
  readonly settings: ClientAddressSettings;
  readonly clock: Clock;
  readonly log: RateLimitLog;
  readonly logIntervalMs?: number;
}

/**
 * Builds the provider. Throws when `settings` are unusable (a malformed trusted-proxy list); the
 * configuration schema reports the same at startup. An address that cannot be resolved is logged
 * once per interval and reason, as a warning when it signals a misconfiguration and as info when
 * the operator chose `none`. Neither the header nor any address is ever logged.
 */
export function createClientAddressProvider(
  deps: ClientAddressProviderDeps,
): ClientAddressProvider {
  const resolve = createClientAddressResolver(deps.settings);
  const throttle = createLogThrottle(deps.clock, deps.logIntervalMs ?? DEFAULT_LOG_INTERVAL_MS);

  function unresolved(reason: UnresolvedReason): ClientSubject {
    const decision = throttle.admit(`client_unresolved:${reason}`);
    if (decision.write) {
      const context = {
        reason,
        ...(decision.suppressed > 0 ? { suppressed: decision.suppressed } : {}),
      };
      if (reason === 'source_disabled') {
        deps.log.info('rate_limit.client_unresolved', context);
      } else {
        deps.log.warn('rate_limit.client_unresolved', context);
      }
    }
    return { kind: 'unresolved-client' };
  }

  return {
    async current() {
      let headers: HeaderReader;
      try {
        headers = await deps.getHeaders();
      } catch {
        return unresolved('no_request');
      }

      const result = resolve(headers);
      return result.status === 'resolved'
        ? { kind: 'client', address: result.address }
        : unresolved(result.reason);
    },
  };
}
