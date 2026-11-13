import { describe, expect, it } from 'vitest';

import { InviteUser } from '@modules/auth/application/commands/invite-user';
import { toActorId } from '@modules/auth/domain/models/ids';

import { administrationWorld } from '../support/administration-world';

const WEBSITE = { kind: 'website', role: 'viewer' } as const;
const SIGNUP = { token: 'token-1', name: 'Ada', password: 'a-long-password-1' };

async function invite(
  current: ReturnType<typeof administrationWorld>,
  email = 'known@example.org',
) {
  expect(
    (await new InviteUser(current.deps).execute({ email, scope: WEBSITE, locale: 'en' })).isOk(),
  ).toBe(true);
}

describe('invitation identity and current authority', () => {
  it('does not replace newer membership decisions with an older invitation role', async () => {
    const current = administrationWorld();
    await new InviteUser(current.deps).execute({
      email: 'known@example.org',
      scope: { ...WEBSITE, role: 'admin' },
      locale: 'en',
    });
    current.roles.set(toActorId('known-1'), ['viewer']);
    current.authenticate('known@example.org');
    expect((await current.accept.execute({ token: 'token-1' })).isOk()).toBe(true);
    expect(current.roles.get(toActorId('known-1'))).toEqual(['viewer']);
  });
  it('requires an existing recipient to sign in and accept before creating membership', async () => {
    const current = administrationWorld();
    await invite(current);
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrapErr().code).toBe(
      'auth.invitation_account_required',
    );
    expect(current.roles.has(toActorId('known-1'))).toBe(false);
    current.authenticate('known@example.org');
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrap().status).toBe(
      'accepted',
    );
    expect(current.roles.get(toActorId('known-1'))).toEqual(['viewer']);
  });

  it('refuses a different signed-in account without consuming the invitation', async () => {
    const current = administrationWorld();
    await invite(current);
    current.session.actorId = toActorId('other-account');
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrapErr().code).toBe(
      'auth.invitation_account_required',
    );
    expect([...current.invitations.values()][0]?.acceptedAt).toBeNull();
    expect(current.roles.has(toActorId('known-1'))).toBe(false);
  });

  it('requires verified email even if the provider supplies a valid session', async () => {
    const current = administrationWorld();
    await invite(current);
    current.authenticate('known@example.org');
    current.unverifiedEmails.add('known@example.org');
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrapErr().code).toBe(
      'auth.email_not_verified',
    );
    expect([...current.invitations.values()][0]?.acceptedAt).toBeNull();
  });

  it('keeps account creation separate from membership and invitation consumption', async () => {
    const current = administrationWorld();
    await invite(current, 'new@example.org');
    expect((await current.accept.execute(SIGNUP))._unsafeUnwrap().status).toBe('verify_account');
    const account = current.accounts.get('new@example.org');
    expect(account).toBeDefined();
    expect(current.roles.has(account ?? toActorId('missing'))).toBe(false);
    expect([...current.invitations.values()][0]?.acceptedAt).toBeNull();
    current.authenticate('new@example.org');
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrap().status).toBe(
      'accepted',
    );
  });

  it('invalidates an offer when its manager loses authority before acceptance', async () => {
    const current = administrationWorld();
    await invite(current);
    current.roles.set(toActorId('admin-1'), ['editor']);
    current.authenticate('known@example.org');
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrapErr().code).toBe(
      'auth.invalid_token',
    );
    expect(current.roles.has(toActorId('known-1'))).toBe(false);
  });

  it('does not create an account after the inviter loses authority', async () => {
    const current = administrationWorld();
    await invite(current, 'new@example.org');
    current.roles.delete(toActorId('admin-1'));
    expect((await current.accept.execute(SIGNUP))._unsafeUnwrapErr().code).toBe(
      'auth.invalid_token',
    );
    expect(current.accounts.has('new@example.org')).toBe(false);
  });

  it('checks target existence again after account setup', async () => {
    const current = administrationWorld();
    await invite(current, 'new@example.org');
    await current.accept.execute(SIGNUP);
    current.authenticate('new@example.org');
    current.websites.delete('default');
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrapErr().code).toBe(
      'auth.invalid_token',
    );
    expect([...current.invitations.values()][0]?.acceptedAt).toBeNull();
  });

  it('rechecks platform authority before accepting platform access', async () => {
    const current = administrationWorld({ actorRoles: ['platform_admin'] });
    await new InviteUser(current.deps).execute({
      email: 'known@example.org',
      scope: { kind: 'platform' },
      locale: 'en',
    });
    current.platformAdmins.delete(toActorId('admin-1'));
    current.authenticate('known@example.org');
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrapErr().code).toBe(
      'auth.invalid_token',
    );
    expect(current.platformAdmins.has(toActorId('known-1'))).toBe(false);
  });

  it('accepts a platform invitation only into the platform role', async () => {
    const current = administrationWorld({ actorRoles: ['platform_admin'] });
    await new InviteUser(current.deps).execute({
      email: 'known@example.org',
      scope: { kind: 'platform' },
      locale: 'en',
    });
    current.authenticate('known@example.org');
    expect((await current.accept.execute({ token: 'token-1' })).isOk()).toBe(true);
    expect(current.platformAdmins.has(toActorId('known-1'))).toBe(true);
    expect(current.roles.has(toActorId('known-1'))).toBe(false);
  });
});

describe('invitation deduplication and distinct scopes', () => {
  it('normalizes email and refuses duplicate pending offers regardless of role', async () => {
    const current = administrationWorld();
    await invite(current, ' Known@Example.org ');
    const duplicate = await new InviteUser(current.deps).execute({
      email: 'KNOWN@example.org',
      scope: { ...WEBSITE, role: 'admin' },
      locale: 'en',
    });
    expect(duplicate._unsafeUnwrapErr().code).toBe('auth.invitation_pending');
    expect(current.invitations.size).toBe(1);
    expect(current.sent).toHaveLength(1);
    expect([...current.invitations.values()][0]?.role).toBe('viewer');
  });

  it('creates only one pending offer when requests race', async () => {
    const current = administrationWorld();
    const command = new InviteUser(current.deps);
    const results = await Promise.all([
      command.execute({ email: 'known@example.org', scope: WEBSITE, locale: 'en' }),
      command.execute({ email: 'known@example.org', scope: WEBSITE, locale: 'en' }),
    ]);
    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    expect(current.sent).toHaveLength(1);
    expect(current.invitations.size).toBe(1);
  });

  it('keeps website and platform offers independent for the same account', async () => {
    const current = administrationWorld({ actorRoles: ['platform_admin'] });
    const command = new InviteUser(current.deps);
    for (const scope of [
      { ...WEBSITE, tenantId: 'default' },
      { ...WEBSITE, tenantId: 'other-site' },
      { kind: 'platform' as const },
    ]) {
      expect(
        (await command.execute({ email: 'known@example.org', scope, locale: 'en' })).isOk(),
      ).toBe(true);
    }
    current.authenticate('known@example.org');
    expect((await current.accept.execute({ token: 'token-1' })).isOk()).toBe(true);
    expect(current.roles.get(toActorId('known-1'))).toEqual(['viewer']);
    expect(current.foreignRoles.has('other-site:known-1')).toBe(false);
    expect(current.platformAdmins.has(toActorId('known-1'))).toBe(false);
    expect(
      [...current.invitations.values()].filter((entry) => entry.acceptedAt === null),
    ).toHaveLength(2);
  });

  it('reports an existing member separately from an account without membership', async () => {
    const current = administrationWorld();
    current.roles.set(toActorId('known-1'), ['employee']);
    const result = await new InviteUser(current.deps).execute({
      email: 'known@example.org',
      scope: WEBSITE,
      locale: 'en',
    });
    expect(result._unsafeUnwrapErr().code).toBe('auth.membership_exists');
    expect(current.sent).toHaveLength(0);
  });
});
