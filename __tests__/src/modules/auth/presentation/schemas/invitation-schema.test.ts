import { describe, expect, it } from 'vitest';

import { acceptInvitationSchema } from '@modules/auth/presentation/schemas/accept-invitation-schema';
import { inviteUserSchema } from '@modules/auth/presentation/schemas/user-admin-schema';

const INVITE = { scope: 'website' as const, email: 'ada@example.org', role: 'viewer' };

describe('invitation boundary validation', () => {
  it('accepts token-only confirmation for an authenticated existing account', () => {
    expect(acceptInvitationSchema.safeParse({ token: 'token' }).success).toBe(true);
  });
  it('accepts the current website flow and an explicit platform-selected website', () => {
    expect(inviteUserSchema.safeParse(INVITE).success).toBe(true);
    const parsed = inviteUserSchema.parse({ ...INVITE, tenantId: 'site-1' });
    if (parsed.scope === 'website') {
      expect(parsed.tenantId).toBe('site-1');
    }
  });

  it('accepts platform invitations without role or tenantId', () => {
    const platformInvite = { scope: 'platform' as const, email: 'ada@example.org' };
    expect(inviteUserSchema.safeParse(platformInvite).success).toBe(true);
  });

  it('rejects unknown or platform-wide roles', () => {
    for (const role of ['platform_admin', 'root', '', 'viewer,admin']) {
      expect(inviteUserSchema.safeParse({ ...INVITE, role }).success).toBe(false);
    }
  });

  it('rejects malformed target identifiers instead of truncating or normalizing them', () => {
    for (const tenantId of ['', 'a'.repeat(65), ' site-1', 'site-1 ', 'site/1', ['site-1'], null]) {
      expect(inviteUserSchema.safeParse({ ...INVITE, tenantId }).success).toBe(false);
    }
    const exact = 'a'.repeat(64);
    const parsed = inviteUserSchema.parse({ ...INVITE, tenantId: exact });
    if (parsed.scope === 'website') {
      expect(parsed.tenantId).toBe(exact);
    }
  });

  it('bounds invitation tokens and keeps the submitted secret byte-for-byte', () => {
    const input = {
      token: 'Case_Sensitive-Token',
      name: 'Ada',
      password: 'a-long-password-1',
      confirmPassword: 'a-long-password-1',
    };
    expect(acceptInvitationSchema.parse(input).token).toBe(input.token);
    expect(acceptInvitationSchema.safeParse({ ...input, token: '' }).success).toBe(false);
    expect(acceptInvitationSchema.safeParse({ ...input, token: 'a'.repeat(513) }).success).toBe(
      false,
    );
  });
});
