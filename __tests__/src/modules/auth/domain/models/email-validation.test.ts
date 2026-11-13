import { describe, expect, it } from 'vitest';

import { AUTH_VALIDATION_CODES } from '@modules/auth/domain/errors/auth-errors';
import {
  CREDENTIAL_LIMITS,
  createPasswordResetRequest,
  createSignInCredentials,
  createSignUpDraft,
} from '@modules/auth/domain/models/credentials';
import {
  createInvitationOffer,
  createPlatformInvitationOffer,
} from '@modules/auth/domain/models/invitation';

const requests = [
  (email: string) => createSignInCredentials({ email, password: 'a-long-password' }),
  (email: string) => createSignUpDraft({ email, name: 'Ada', password: 'a-long-password' }),
  (email: string) => createPasswordResetRequest({ email }),
  (email: string) => createInvitationOffer({ email, role: 'viewer' }),
  createPlatformInvitationOffer,
];

describe('email rules across account and invitation flows', () => {
  it('normalizes case and surrounding whitespace in every flow', () => {
    for (const create of requests) {
      expect(create('  Ada@EXAMPLE.ORG  ')._unsafeUnwrap().email).toBe('ada@example.org');
    }
  });

  it.each([
    ['   ', AUTH_VALIDATION_CODES.emailRequired],
    ['not-an-address', AUTH_VALIDATION_CODES.emailInvalid],
    [`${'a'.repeat(CREDENTIAL_LIMITS.emailMax)}@example.org`, AUTH_VALIDATION_CODES.emailTooLong],
  ])('rejects %j consistently', (email, code) => {
    for (const create of requests) {
      expect(create(email)._unsafeUnwrapErr().fieldErrors['email']).toEqual([code]);
    }
  });
});
