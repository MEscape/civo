import { toNextJsHandler } from 'better-auth/next-js';

import { once } from '@lib/utils';

import type { BetterAuthInstance } from './create-auth';

type RouteHandler = (request: Request) => Promise<Response>;

export interface AuthRouteHandlers {
  readonly GET: RouteHandler;
  readonly POST: RouteHandler;
}

const NOT_FOUND_STATUS = 404;

/**
 * Handlers for `app/api/auth/[...all]/route.ts`. This is a Route Handler
 * with a real HTTP consumer: the emailed verification and reset links are
 * opened by a browser and land here. Validation, rate limiting and the
 * token checks run inside Better Auth; this file only delegates.
 *
 * The instance is created on the first request, not at import, so a build
 * that imports the route does not need auth configuration. While auth is
 * disabled the endpoint answers 404 instead of throwing.
 */
export function createAuthRouteHandlers(options: {
  readonly isEnabled: boolean;
  readonly getAuth: () => BetterAuthInstance;
}): AuthRouteHandlers {
  const getHandlers = once(() => toNextJsHandler(options.getAuth()));
  const notFound = () => Promise.resolve(new Response(null, { status: NOT_FOUND_STATUS }));

  return {
    GET: (request) => (options.isEnabled ? getHandlers().GET(request) : notFound()),
    POST: (request) => (options.isEnabled ? getHandlers().POST(request) : notFound()),
  };
}
