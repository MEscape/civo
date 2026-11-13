import { describe, expect, it, vi } from 'vitest';

import { authenticationApiFrom } from '@modules/auth/infrastructure/better-auth/better-auth-authentication-api';

describe('Better Auth API boundary', () => {
  it('separates trusted request headers from every provider request body and preserves provider failures', async () => {
    const provider = {
      api: {
        signInEmail: vi.fn(async () => undefined),
        signUpEmail: vi.fn(async () => undefined),
        signOut: vi.fn(async () => undefined),
        requestPasswordReset: vi.fn(async () => undefined),
        resetPassword: vi.fn(async () => undefined),
      },
    };
    // The provider fixture implements only the five capabilities this adapter is permitted to call.
    const api = authenticationApiFrom(provider as never);
    const headers = new Headers({ 'x-test-request': 'request-1' });
    const credentials = {
      email: 'person@example.org',
      password: 'private-password',
      callbackURL: '/verified',
    };
    await api.signInEmail({ ...credentials, headers });
    expect(provider.api.signInEmail).toHaveBeenCalledWith({ body: credentials, headers });
    await api.signUpEmail({ ...credentials, name: 'Ada', headers });
    expect(provider.api.signUpEmail).toHaveBeenCalledWith({
      body: { ...credentials, name: 'Ada' },
      headers,
    });
    await api.signOut({ headers });
    expect(provider.api.signOut).toHaveBeenCalledWith({ headers });
    await api.requestPasswordReset({ email: credentials.email, redirectTo: '/reset', headers });
    expect(provider.api.requestPasswordReset).toHaveBeenCalledWith({
      body: { email: credentials.email, redirectTo: '/reset' },
      headers,
    });
    const reset = { token: 'valid-token', newPassword: 'new-private-password' };
    await api.resetPassword({ ...reset, headers });
    expect(provider.api.resetPassword).toHaveBeenCalledWith({ body: reset, headers });
    const failure = new Error('Provider unavailable');
    provider.api.signOut.mockRejectedValue(failure);
    await expect(api.signOut({ headers })).rejects.toBe(failure);
  });
});
