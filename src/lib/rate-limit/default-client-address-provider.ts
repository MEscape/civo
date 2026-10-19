import 'server-only';

import { systemClock } from '@lib/clock';
import { resolveRateLimitSettings, serverEnv } from '@lib/config/server';

import { createClientAddressProvider } from './client-address-provider';
import { createRateLimitLog } from './rate-limit-logger';

import type { HeaderReader } from './client-address';
import type { ClientAddressProvider } from './client-address-provider';

/**
 * The application's client-address provider, built from validated configuration. Only
 * `composition.ts` files call this, passing the framework's header reader:
 * `getClientAddressProvider(() => headers())`.
 */
export function getClientAddressProvider(
  getHeaders: () => Promise<HeaderReader>,
): ClientAddressProvider {
  return createClientAddressProvider({
    getHeaders,
    settings: resolveRateLimitSettings(serverEnv).clientAddress,
    clock: systemClock,
    log: createRateLimitLog(),
  });
}
