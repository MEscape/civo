import { describe, expect, it } from 'vitest';

import { AcceptInvitation } from '@modules/auth/application/commands/accept-invitation';
import { InviteUser } from '@modules/auth/application/commands/invite-user';
import { AUTH_RATE_LIMITS } from '@modules/auth/application/rate-limits';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';

import { administrationWorld as world } from '../support/administration-world';

describe('inviting and accepting', () => {
  it('emails a single-use link to a new address and stores only its hash', async () => {
    const { deps, sent, invitations } = world();

    const outcome = await new InviteUser(deps).execute({
      email: ' New@Example.org ',
      scope: { kind: 'website', role: 'employee' },
      locale: 'en',
    });

    expect(outcome.isOk()).toBe(true);
    expect(sent).toEqual([{ to: 'new@example.org', token: 'token-1' }]);
    expect([...invitations.values()][0]?.tokenHash).toBe('hash:token-1');
  });

  it('invites an existing account without silently granting access', async () => {
    const { deps, sent, roles } = world();

    const outcome = await new InviteUser(deps).execute({
      email: 'known@example.org',
      scope: { kind: 'website', role: 'employee' },
      locale: 'de',
    });

    expect(outcome.isOk()).toBe(true);
    expect(sent).toHaveLength(1);
    expect(roles.has(toActorId('known-1'))).toBe(false);
  });

  it('lets only an administrator invite', async () => {
    const { deps } = world({ actorRoles: ['editor'] });

    const outcome = await new InviteUser(deps).execute({
      email: 'x@example.org',
      scope: { kind: 'website', role: 'viewer' },
      locale: 'en',
    });

    expect(outcome._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('creates the account with the invited role and burns the link', async () => {
    const current = world();
    const { deps, accept, roles } = current;
    await new InviteUser(deps).execute({
      email: 'new@example.org',
      scope: { kind: 'website', role: 'employee' },
      locale: 'en',
    });

    const first = await accept.execute({
      token: 'token-1',
      name: 'Eve',
      password: 'a-long-password-1',
    });
    expect(first._unsafeUnwrap().status).toBe('verify_account');
    expect(roles.has(current.accounts.get('new@example.org') ?? toActorId('missing'))).toBe(false);
    current.authenticate('new@example.org');
    expect((await accept.execute({ token: 'token-1' }))._unsafeUnwrap().status).toBe('accepted');
    const second = await accept.execute({
      token: 'token-1',
      name: 'Eve',
      password: 'a-long-password-1',
    });

    expect(first.isOk()).toBe(true);
    expect(
      [...roles.entries()].some(([, held]) => held.length === 1 && held[0] === 'employee'),
    ).toBe(true);
    // A repeat by the same signed-in account is idempotent, not an invalid link.
    expect(second._unsafeUnwrap().status).toBe('already_member');
  });

  it('answers an unknown token like a used one', async () => {
    const { accept } = world();

    const result = await accept.execute({
      token: 'guess',
      name: 'Eve',
      password: 'a-long-password-1',
    });

    expect(result._unsafeUnwrapErr().code).toBe('auth.invalid_token');
  });

  it('gives the link back when the password is refused, so it can be tried again', async () => {
    const { deps, accept } = world();
    await new InviteUser(deps).execute({
      email: 'new@example.org',
      scope: { kind: 'website', role: 'viewer' },
      locale: 'en',
    });

    const weak = await accept.execute({ token: 'token-1', name: 'Eve', password: 'short' });
    const retry = await accept.execute({
      token: 'token-1',
      name: 'Eve',
      password: 'a-long-password-1',
    });

    expect(weak.isErr()).toBe(true);
    expect(retry.isOk()).toBe(true);
  });
});

const ACCEPT = { token: 'token-1', name: 'Ada', password: 'a-long-password-1' };

async function invitedWorld(options: Parameters<typeof world>[0] = {}) {
  const current = world(options);
  const result = await new InviteUser(current.deps).execute({
    email: 'new@example.org',
    scope: { kind: 'website', role: 'viewer' },
    locale: 'en',
  });
  expect(result.isOk()).toBe(true);
  return current;
}

describe('invitation scope and platform administration', () => {
  it('allows a platform administrator to invite into a selected website through the canonical lifecycle', async () => {
    const current = world({ actorRoles: ['platform_admin'] });
    const result = await new InviteUser(current.deps).execute({
      email: 'new@example.org',
      scope: { kind: 'website', role: 'editor', tenantId: 'other-site' },
      locale: 'en',
    });
    expect(result.isOk()).toBe(true);
    expect([...current.invitations.values()]).toMatchObject([
      { tenantId: 'other-site', role: 'editor' },
    ]);
    expect((await current.accept.execute(ACCEPT)).isOk()).toBe(true);
    current.authenticate('new@example.org');
    expect((await current.accept.execute({ token: ACCEPT.token })).isOk()).toBe(true);
    expect(current.foreignRoles.get('other-site:new-1')).toEqual(['editor']);
    expect(current.roles.has(toActorId('new-1'))).toBe(false);
  });

  it('allows a platform administrator to invite a new platform administrator', async () => {
    const current = world({ actorRoles: ['platform_admin'] });
    const result = await new InviteUser(current.deps).execute({
      email: 'new-admin@example.org',
      scope: { kind: 'platform' },
      locale: 'en',
    });
    expect(result.isOk()).toBe(true);
    expect([...current.invitations.values()]).toMatchObject([
      { tenantId: 'platform', role: 'platform_admin' },
    ]);
  });

  it('invites an existing account to another website without granting access before acceptance', async () => {
    const current = world({ actorRoles: ['platform_admin'] });
    const result = await new InviteUser(current.deps).execute({
      email: 'known@example.org',
      scope: { kind: 'website', role: 'employee', tenantId: 'other-site' },
      locale: 'en',
    });
    expect(result.isOk()).toBe(true);
    expect(current.sent).toHaveLength(1);
  });

  it('refuses a website administrator targeting another website before reading its existence', async () => {
    const current = world();
    current.faults.tenant = true;
    const result = await new InviteUser(current.deps).execute({
      email: 'new@example.org',
      scope: { kind: 'website', role: 'admin', tenantId: 'other-site' },
      locale: 'en',
    });
    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    expect(current.invitations.size).toBe(0);
    expect(current.sent).toEqual([]);
  });

  it('allows an explicit current website target for its own administrator', async () => {
    const current = world();
    const result = await new InviteUser(current.deps).execute({
      email: 'new@example.org',
      scope: { kind: 'website', role: 'viewer', tenantId: 'default' },
      locale: 'en',
    });
    expect(result.isOk()).toBe(true);
  });

  it('never offers platform privileges from a website invitation', async () => {
    const current = world({ actorRoles: ['platform_admin'] });
    const result = await new InviteUser(current.deps).execute({
      email: 'new@example.org',
      scope: { kind: 'website', role: 'platform_admin', tenantId: 'other-site' },
      locale: 'en',
    });
    expect(result._unsafeUnwrapErr().kind).toBe('validation');
    expect(current.invitations.size).toBe(0);
  });

  it('refuses missing, malformed, and reserved website targets', async () => {
    for (const tenantId of [
      'missing-site',
      'platform',
      'unassigned',
      '',
      'x'.repeat(65),
      'bad/site',
    ]) {
      const current = world({ actorRoles: ['platform_admin'] });
      const result = await new InviteUser(current.deps).execute({
        email: 'new@example.org',
        scope: { kind: 'website', role: 'viewer', tenantId },
        locale: 'en',
      });
      expect(result._unsafeUnwrapErr().kind).toBe('validation');
      expect(current.sent).toEqual([]);
    }
  });

  it('reports existing website membership independently of account existence', async () => {
    const current = world();
    current.roles.set(toActorId('known-1'), ['admin', 'employee']);
    const result = await new InviteUser(current.deps).execute({
      email: 'known@example.org',
      scope: { kind: 'website', role: 'viewer' },
      locale: 'en',
    });
    expect(result._unsafeUnwrapErr().code).toBe('auth.membership_exists');
    expect(current.roles.get(toActorId('known-1'))).toEqual(['admin', 'employee']);
  });

  it('revokes an undeliverable link and reports mail failure accurately', async () => {
    const current = world();
    current.faults.mail = true;
    const result = await new InviteUser(current.deps).execute({
      email: 'new@example.org',
      scope: { kind: 'website', role: 'viewer' },
      locale: 'en',
    });
    expect(result._unsafeUnwrapErr().code).toBe('auth.mail_delivery_failed');
    expect(current.invitations.size).toBe(0);
    expect(current.audit).not.toContain('invitation.created');
  });

  it('keeps the mail failure as the answer when the compensating revoke fails too', async () => {
    const current = world();
    current.faults.mail = true;
    current.faults.revoke = true;
    const result = await new InviteUser(current.deps).execute({
      email: 'new@example.org',
      scope: { kind: 'website', role: 'viewer' },
      locale: 'en',
    });
    expect(result._unsafeUnwrapErr().code).toBe('auth.mail_delivery_failed');
    expect(current.audit).not.toContain('invitation.created');
  });
});

describe('acceptance failure and retry guarantees', () => {
  it('lets exactly one competing acceptance create access', async () => {
    const current = await invitedWorld();
    await current.accept.execute(ACCEPT);
    current.authenticate('new@example.org');
    const results = await Promise.all([
      current.accept.execute(ACCEPT),
      current.accept.execute(ACCEPT),
    ]);
    expect(results.map((result) => result._unsafeUnwrap().status).sort()).toEqual([
      'accepted',
      'already_member',
    ]);
    expect(current.audit.filter((event) => event === 'invitation.accepted')).toHaveLength(1);
  });

  it('reports already_member, consumes the offer and never widens a role the account already holds', async () => {
    const current = await invitedWorld();
    await current.accept.execute(ACCEPT);
    current.authenticate('new@example.org');
    const id = current.accounts.get('new@example.org') ?? toActorId('missing');
    current.roles.set(id, ['viewer']);
    current.audit.length = 0;
    const [offer] = [...current.invitations.values()];
    if (offer === undefined) {
      throw new Error('no invitation was stored');
    }
    current.invitations.set(offer.id, { ...offer, role: 'admin' });

    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrap().status).toBe(
      'already_member',
    );

    expect(current.roles.get(id)).toEqual(['viewer']);
    expect([...current.invitations.values()][0]?.acceptedAt).not.toBeNull();
    expect(current.audit).not.toContain('invitation.accepted');
  });

  it('answers a consumed link as already_member only for the verified signed-in account that holds the access', async () => {
    const current = await invitedWorld();
    await current.accept.execute(ACCEPT);
    current.authenticate('new@example.org');
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrap().status).toBe(
      'accepted',
    );
    const id = current.accounts.get('new@example.org') ?? toActorId('missing');

    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrap().status).toBe(
      'already_member',
    );

    current.session.actorId = null;
    expect((await current.accept.execute(ACCEPT))._unsafeUnwrapErr().code).toBe(
      'auth.invalid_token',
    );
    current.authenticate('known@example.org');
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrapErr().code).toBe(
      'auth.invalid_token',
    );
    current.authenticate('new@example.org');
    current.roles.delete(id);
    expect((await current.accept.execute({ token: 'token-1' }))._unsafeUnwrapErr().code).toBe(
      'auth.invalid_token',
    );
  });

  it('puts the offered role into the created and accepted audit events, without email or token', async () => {
    const current = await invitedWorld();
    await current.accept.execute(ACCEPT);
    current.authenticate('new@example.org');
    await current.accept.execute({ token: 'token-1' });

    expect(current.auditEvents).toMatchObject([
      { type: 'invitation.created', tenantId: 'default', role: 'viewer' },
      { type: 'invitation.accepted', tenantId: 'default', role: 'viewer' },
    ]);
    expect(JSON.stringify(current.auditEvents)).not.toMatch(/@|token-1/);
  });

  it('rejects missing websites before account creation', async () => {
    const current = await invitedWorld();
    current.websites.clear();
    const result = await current.accept.execute(ACCEPT);
    expect(result._unsafeUnwrapErr().code).toBe('auth.invalid_token');
    expect(current.accounts.has('new@example.org')).toBe(false);
  });

  it('rejects inconsistent role scopes before account creation', async () => {
    for (const change of [
      { role: 'platform_admin' as const },
      { tenantId: toTenantId('platform') },
      { tenantId: toTenantId('unassigned') },
    ]) {
      const current = await invitedWorld();
      const entry = [...current.invitations.values()][0];
      if (entry === undefined) {
        throw new Error('Expected invitation');
      }
      current.invitations.set(entry.id, { ...entry, ...change });
      const result = await current.accept.execute(ACCEPT);
      expect(result._unsafeUnwrapErr().code).toBe('auth.invalid_token');
      expect(current.accounts.has('new@example.org')).toBe(false);
    }
  });

  it('never accepts a revoked invitation', async () => {
    const current = await invitedWorld();
    current.invitations.clear();
    expect((await current.accept.execute(ACCEPT))._unsafeUnwrapErr().code).toBe(
      'auth.invalid_token',
    );
    expect(current.accounts.has('new@example.org')).toBe(false);
  });

  it('preserves infrastructure failures rather than reporting an invalid link', async () => {
    const current = await invitedWorld();
    current.faults.tenant = true;
    expect((await current.accept.execute(ACCEPT))._unsafeUnwrapErr().code).toBe(
      'auth.tenant_failed',
    );
    current.faults.tenant = false;
    current.faults.invitation = true;
    expect((await current.accept.execute(ACCEPT))._unsafeUnwrapErr().code).toBe(
      'auth.invitation_lookup_failed',
    );
  });

  it('releases a claim after the account provider fails and allows retry', async () => {
    const current = await invitedWorld();
    current.faults.signUp = true;
    expect((await current.accept.execute(ACCEPT))._unsafeUnwrapErr().code).toBe(
      'auth.provider_failed',
    );
    expect([...current.invitations.values()][0]?.acceptedAt).toBeNull();
    current.faults.signUp = false;
    expect((await current.accept.execute(ACCEPT)).isOk()).toBe(true);
  });

  it('keeps the invitation open after account setup and atomically retries a failed membership write', async () => {
    const current = await invitedWorld();
    await current.accept.execute(ACCEPT);
    current.authenticate('new@example.org');
    current.faults.grant = true;
    expect((await current.accept.execute(ACCEPT))._unsafeUnwrapErr().code).toBe(
      'auth.grant_failed',
    );
    const id = current.accounts.get('new@example.org');
    if (id === undefined) {
      throw new Error('Expected created account');
    }
    current.roles.set(id, ['employee']);
    current.faults.grant = false;
    expect((await current.accept.execute(ACCEPT)).isOk()).toBe(true);
    expect(current.roles.get(id)).toEqual(['employee']);
  });

  it('never consumes a link when account setup fails, even if the obsolete release mechanism would fail', async () => {
    const current = await invitedWorld();
    current.faults.signUp = true;
    current.faults.release = true;
    expect((await current.accept.execute(ACCEPT))._unsafeUnwrapErr().code).toBe(
      'auth.provider_failed',
    );
    expect([...current.invitations.values()][0]?.acceptedAt).toBeNull();
    expect(current.audit).not.toContain('invitation.accepted');
  });

  it('counts invalid tokens against the client budget before touching persistence', async () => {
    const current = world();
    const accept = new AcceptInvitation(current.acceptDependencies);
    for (let count = 0; count < AUTH_RATE_LIMITS.signUpClient.limit; count += 1) {
      expect((await accept.execute({ ...ACCEPT, token: 'unknown' }))._unsafeUnwrapErr().code).toBe(
        'auth.invalid_token',
      );
    }
    current.faults.invitation = true;
    expect((await accept.execute({ ...ACCEPT, token: 'unknown' }))._unsafeUnwrapErr().code).toBe(
      'auth.rate_limited',
    );
  });
});
