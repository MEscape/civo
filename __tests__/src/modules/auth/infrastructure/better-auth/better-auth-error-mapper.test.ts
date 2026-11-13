import { APIError } from 'better-auth/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_ERROR_CODES } from '@modules/auth/domain/errors/auth-errors';
import { mapBetterAuthError } from '@modules/auth/infrastructure/better-auth/map-better-auth-error';

import { infrastructureError } from '@lib/errors';

const log = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn() }));
vi.mock('@lib/logger', () => ({ logger: { withContext: () => log } }));

describe('mapBetterAuthError infrastructure adapter', () => {
  beforeEach(() => vi.clearAllMocks());
  const fallback = (cause: unknown) =>
    infrastructureError('auth.provider_failed', 'Better Auth failed.', cause);

  it('maps non-APIError to onUnclassified error', () => {
    const rawError = new Error('database connection lost');
    const result = mapBetterAuthError(rawError, fallback);
    expect(result.code).toBe('auth.provider_failed');
    expect(result.cause).toBe(rawError);
  });

  it('records unexpected non-API failures once without logging provider messages or causes', () => {
    const rawError = new Error('connection failed for victim@example.org, token=SECRET');
    const mapped = mapBetterAuthError(rawError, fallback);

    expect(mapped.cause).toBe(rawError);
    expect(log.error).toHaveBeenCalledExactlyOnceWith('auth.provider_failed', {
      kind: 'infrastructure',
      code: 'auth.provider_failed',
    });
    expect(JSON.stringify(log.error.mock.calls)).not.toMatch(/victim|SECRET/);
  });

  it('maps credential_failure codes to invalidCredentials', () => {
    const codes = [
      'INVALID_EMAIL_OR_PASSWORD',
      'INVALID_PASSWORD',
      'USER_NOT_FOUND',
      'CREDENTIAL_ACCOUNT_NOT_FOUND',
      'INVALID_USER',
    ];
    for (const code of codes) {
      const err = new APIError('BAD_REQUEST', { message: 'err', code });
      const mapped = mapBetterAuthError(err, fallback);
      expect(mapped.code).toBe(AUTH_ERROR_CODES.invalidCredentials);
    }
  });

  it('maps reauthentication codes to reauthenticationRequired', () => {
    const codes = ['SESSION_EXPIRED', 'SESSION_NOT_FRESH'];
    for (const code of codes) {
      const err = new APIError('UNAUTHORIZED', { message: 'err', code });
      const mapped = mapBetterAuthError(err, fallback);
      expect(mapped.code).toBe(AUTH_ERROR_CODES.reauthenticationRequired);
    }
  });

  it('maps token codes to invalidToken', () => {
    const codes = ['INVALID_TOKEN', 'TOKEN_EXPIRED'];
    for (const code of codes) {
      const err = new APIError('BAD_REQUEST', { message: 'err', code });
      const mapped = mapBetterAuthError(err, fallback);
      expect(mapped.code).toBe(AUTH_ERROR_CODES.invalidToken);
    }
  });

  it('maps email_not_verified code', () => {
    const err = new APIError('FORBIDDEN', { message: 'err', code: 'EMAIL_NOT_VERIFIED' });
    const mapped = mapBetterAuthError(err, fallback);
    expect(mapped.code).toBe(AUTH_ERROR_CODES.emailNotVerified);
  });

  it('maps conflict codes to accountConflict', () => {
    const codes = [
      'USER_ALREADY_EXISTS',
      'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
      'LINKED_ACCOUNT_ALREADY_EXISTS',
      'SOCIAL_ACCOUNT_ALREADY_LINKED',
    ];
    for (const code of codes) {
      const err = new APIError('CONFLICT', { message: 'err', code });
      const mapped = mapBetterAuthError(err, fallback);
      expect(mapped.code).toBe(AUTH_ERROR_CODES.accountConflict);
    }
  });

  it('maps validation codes to authValidationFailed', () => {
    const codes = [
      'INVALID_EMAIL',
      'PASSWORD_TOO_SHORT',
      'PASSWORD_TOO_LONG',
      'VALIDATION_ERROR',
      'MISSING_FIELD',
      'FIELD_NOT_ALLOWED',
      'BODY_MUST_BE_AN_OBJECT',
    ];
    for (const code of codes) {
      const err = new APIError('BAD_REQUEST', { message: 'err', code });
      const mapped = mapBetterAuthError(err, fallback);
      expect(mapped.code).toBe(AUTH_ERROR_CODES.validationFailed);
    }
  });

  it('maps bare 401 without recognized code to unauthenticated', () => {
    const err = new APIError('UNAUTHORIZED');
    const mapped = mapBetterAuthError(err, fallback);
    expect(mapped.code).toBe(AUTH_ERROR_CODES.unauthenticated);
  });

  it('maps unknown provider code to fallback infrastructure error', () => {
    const err = new APIError('INTERNAL_SERVER_ERROR', {
      message: 'something weird',
      code: 'UNEXPECTED_INTERNAL_CODE',
    });
    const mapped = mapBetterAuthError(err, fallback);
    expect(mapped.code).toBe('auth.provider_failed');
  });
});
