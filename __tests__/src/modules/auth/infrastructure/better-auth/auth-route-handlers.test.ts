import { describe, expect, it, vi } from 'vitest';

import type { BetterAuthInstance } from '@modules/auth/infrastructure/better-auth/create-auth';
import { createAuthRouteHandlers } from '@modules/auth/infrastructure/better-auth/create-auth-route-handlers';

import { infrastructureError, rateLimitedError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const BASE = 'http://localhost:3000/api/auth';

type Admit = Parameters<typeof createAuthRouteHandlers>[0]['admit'];

function setup(options: { isEnabled?: boolean; admit?: Admit } = {}) {
  const handler = vi.fn(() => Promise.resolve(new Response('served', { status: 200 })));
  const admit = options.admit ?? okAdmit();
  const handlers = createAuthRouteHandlers({
    isEnabled: options.isEnabled ?? true,
    getAuth: () => ({ handler }) as unknown as BetterAuthInstance,
    admit,
  });
  return { handlers, handler, admit };
}

function okAdmit() {
  return vi.fn((): ReturnType<Admit> => okAsync(undefined));
}

const get = (path: string) => new Request(`${BASE}${path}`);
const post = (path: string) => new Request(`${BASE}${path}`, { method: 'POST', body: '{}' });

describe('the HTTP endpoint of the identity provider', () => {
  it('serves the two emailed links after the budget let them through', async () => {
    const { handlers, handler, admit } = setup();

    const verify = await handlers.GET(get('/verify-email?token=abc&callbackURL=%2F'));
    const reset = await handlers.GET(get('/reset-password/some-token?callbackURL=%2Freset'));

    expect(await verify.text()).toBe('served');
    expect(reset.status).toBe(200);
    expect(admit).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['sign-in over HTTP', post('/sign-in/email')],
    ['sign-up over HTTP', post('/sign-up/email')],
    ['a session read', get('/get-session')],
    ['a POST to a link path', post('/verify-email')],
    ['a link path with more segments', get('/reset-password/a/b')],
    ['the bare endpoint', get('')],
  ])('does not exist: %s', async (_name, request) => {
    const { handlers, handler, admit } = setup();

    const answer = await (request.method === 'POST' ? handlers.POST : handlers.GET)(request);

    expect(answer.status).toBe(404);
    expect(admit).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses a link when the budget is used up, and says when to come back', async () => {
    const admit = vi.fn((): ReturnType<Admit> =>
      errAsync(rateLimitedError('auth.rate_limited', 'Too many.', 42)),
    );
    const { handlers, handler } = setup({ admit });

    const answer = await handlers.GET(get('/verify-email?token=abc'));

    expect(answer.status).toBe(429);
    expect(answer.headers.get('Retry-After')).toBe('42');
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses a link, without saying why, when the limiter itself is down', async () => {
    const admit = vi.fn((): ReturnType<Admit> =>
      errAsync(infrastructureError('auth.rate_limiter_failed', 'down')),
    );
    const { handlers, handler } = setup({ admit });

    const answer = await handlers.GET(get('/reset-password/token'));

    expect(answer.status).toBe(503);
    expect(await answer.text()).toBe('');
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers 404 to everything while authentication is off, and builds nothing', async () => {
    const getAuth = vi.fn();
    const handlers = createAuthRouteHandlers({
      isEnabled: false,
      getAuth,
      admit: okAdmit(),
    });

    expect((await handlers.GET(get('/verify-email'))).status).toBe(404);
    expect(getAuth).not.toHaveBeenCalled();
  });
});
