import { describe, expect, it } from 'vitest';

import { RevokeInvitation } from '@modules/auth/application/commands/revoke-invitation';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { SCOPE_IDS, userManagementScopeWorld } from '../support/user-management-scope-world';

function world() {
  const source = userManagementScopeWorld();
  const events: Array<{ readonly type: string }> = [];
  const removed: string[] = [];
  source.deps.audit.record = (event) => events.push(event);
  source.deps.invitations.revoke = (id) => {
    removed.push(id);
    return okAsync(true);
  };
  return { ...source, events, removed, command: new RevokeInvitation(source.deps) };
}

describe('RevokeInvitation', () => {
  it('authorizes an independently managed target and records only the removed invitation', async () => {
    const { command, events, removed } = world();
    expect((await command.execute('invitation-1', SCOPE_IDS.b)).isOk()).toBe(true);
    expect(removed).toEqual(['invitation-1']);
    expect(events).toEqual([
      expect.objectContaining({
        type: 'invitation.revoked',
        actorId: SCOPE_IDS.manager,
        tenantId: SCOPE_IDS.b,
        invitationId: 'invitation-1',
      }),
    ]);
  });

  it('refuses read-only membership before attempting revocation', async () => {
    const { command, removed, events } = world();
    expect((await command.execute('invitation-1', SCOPE_IDS.c))._unsafeUnwrapErr().kind).toBe(
      'forbidden',
    );
    expect(removed).toEqual([]);
    expect(events).toEqual([]);
  });

  it('treats malformed and already absent invitations as idempotent success without events', async () => {
    const { command, deps, removed, events } = world();
    expect((await command.execute('', SCOPE_IDS.a)).isOk()).toBe(true);
    expect(removed).toEqual([]);
    deps.invitations.revoke = () => okAsync(false);
    expect((await command.execute('absent', SCOPE_IDS.a)).isOk()).toBe(true);
    expect(events).toEqual([]);
  });

  it('propagates persistence failure without recording a successful revocation', async () => {
    const { command, deps, events } = world();
    const failure = infrastructureError('auth.invitation_failed', 'Unavailable');
    deps.invitations.revoke = () => errAsync(failure);
    expect((await command.execute('invitation-1', SCOPE_IDS.a))._unsafeUnwrapErr()).toBe(failure);
    expect(events).toEqual([]);
  });
});
