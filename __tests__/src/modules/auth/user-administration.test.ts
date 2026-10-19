import { describe, expect, it } from 'vitest';

import { AcceptInvitation } from '@modules/auth/application/commands/accept-invitation';
import { ChangeUserRoles } from '@modules/auth/application/commands/change-user-roles';
import { InviteUser } from '@modules/auth/application/commands/invite-user';
import { RemoveUser } from '@modules/auth/application/commands/remove-user';
import { permissionDenied } from '@modules/auth/domain/errors/auth-errors';
import { decide } from '@modules/auth/domain/models/authorize';
import { toActorId, toInvitationId, toTenantId } from '@modules/auth/domain/models/ids';
import type { ActorId } from '@modules/auth/domain/models/ids';
import type { Invitation } from '@modules/auth/domain/models/invitation';
import { permissionsForRole } from '@modules/auth/domain/models/role';
import type { Role } from '@modules/auth/domain/models/role';

import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

import { clientAt, createTestRateLimiter } from '../../support/rate-limiting';

const TENANT = toTenantId('default');
const ADMIN = toActorId('admin-1');
const NOW = new Date('2026-10-11T10:00:00Z');

/** Everything the administration use cases touch, in memory. */
function world(options: { readonly actorRoles?: readonly Role[] } = {}) {
  const roles = new Map<ActorId, Role[]>([
    [ADMIN, ['admin']],
    [toActorId('editor-1'), ['editor']],
    [toActorId('admin-2'), ['admin']],
  ]);
  const invitations = new Map<string, Invitation & { tokenHash: string }>();
  const accounts = new Map<string, ActorId>([['known@example.org', toActorId('known-1')]]);
  const sent: Array<{ to: string; token: string }> = [];
  const audit: string[] = [];
  const actorRoles = options.actorRoles ?? ['admin'];

  const authorization = {
    requireInTenant: (permission: Parameters<typeof decide>[1]) => {
      const actor = { id: ADMIN, tenantId: TENANT, roles: actorRoles };
      return decide(actor, permission).isAllowed ? okAsync(actor) : errAsync(permissionDenied());
    },
    requireOnResource: () => errAsync(permissionDenied()),
  };

  function replaceKeepingAdministrator(id: ActorId, next: readonly Role[]): boolean {
    const administrators = [...roles.values()].filter((held) => held.includes('admin')).length;
    const isLastAdministrator = roles.get(id)?.includes('admin') === true && administrators <= 1;
    if (isLastAdministrator && !next.includes('admin')) {
      return false;
    }
    if (next.length === 0) {
      roles.delete(id);
    } else {
      roles.set(id, [...next]);
    }
    return true;
  }

  const members = {
    findRoles: (id: ActorId) => okAsync(roles.get(id) ?? []),
    listMembers: () => okAsync({ members: new Map(roles), isTruncated: false }),
    replaceRoles: (id: ActorId, _t: unknown, next: readonly Role[]) => {
      roles.set(id, [...next]);
      return okAsync(undefined);
    },
    // The real repository does this count and the write in one locked transaction.
    replaceRolesKeepingAdministrator: (id: ActorId, _t: unknown, next: readonly Role[]) =>
      okAsync(replaceKeepingAdministrator(id, next)),
    removeMemberKeepingAdministrator: (id: ActorId) => okAsync(replaceKeepingAdministrator(id, [])),
  };

  const hashed = (token: string) => `hash:${token}`;
  let counter = 0;
  const repository = {
    create: (draft: any) => {
      counter += 1;
      const invitation = {
        id: toInvitationId(`inv-${counter}`),
        tenantId: draft.tenantId,
        email: draft.email,
        role: draft.role,
        invitedBy: draft.invitedBy,
        expiresAt: draft.expiresAt,
        acceptedAt: null,
        createdAt: NOW,
        tokenHash: draft.tokenHash,
      };
      invitations.set(invitation.id, invitation);
      return okAsync(invitation as Invitation);
    },
    findByTokenHash: (hash: string) =>
      okAsync([...invitations.values()].find((entry) => entry.tokenHash === hash) ?? null),
    claim: (id: string) => {
      const entry = invitations.get(id);
      if (entry?.acceptedAt !== null) {
        return okAsync(false);
      }
      invitations.set(id, { ...entry, acceptedAt: NOW });
      return okAsync(true);
    },
    release: (id: string) => {
      const entry = invitations.get(id);
      if (entry !== undefined) {
        invitations.set(id, { ...entry, acceptedAt: null });
      }
      return okAsync(undefined);
    },
    listOpen: (_t: unknown, _n: unknown, page: Parameters<typeof toPage>[2]) =>
      okAsync(toPage([] as Invitation[], 0, page)),
    revoke: (id: string) => {
      invitations.delete(id);
      return okAsync(undefined);
    },
  };

  let tokenCounter = 0;
  const tokens = {
    issue: () => {
      tokenCounter += 1;
      const token = `token-${tokenCounter}`;
      return { token, hash: hashed(token) };
    },
    hash: hashed,
  };

  const directory = {
    search: () => okAsync(toPage([], 0, { page: 1, pageSize: 25 })),
    findByEmail: (email: string) => {
      const id = accounts.get(email);
      return okAsync(
        id === undefined ? null : { id, email, name: 'N', emailVerified: true, createdAt: NOW },
      );
    },
  };

  const mailer = {
    sendInvitation: (message: { to: string; token: string }) => {
      sent.push({ to: message.to, token: message.token });
      return okAsync(undefined);
    },
  };

  const deps = {
    authorization,
    rateLimiter: createTestRateLimiter(),
    members,
    directory,
    invitations: repository,
    tokens,
    mailer,
    audit: { record: (event: { type: string }) => audit.push(event.type) },
    clock: { now: () => NOW },
  } as never;

  const authenticator = {
    signUp: (draft: { email: string }) => {
      accounts.set(draft.email, toActorId(`new-${accounts.size}`));
      return okAsync(undefined);
    },
  };
  const accept = new AcceptInvitation({
    authenticator,
    rateLimiter: createTestRateLimiter(),
    clientAddress: clientAt('203.0.113.7'),
    audit: { record: (event: { type: string }) => audit.push(event.type) },
    invitations: repository,
    tokens,
    members,
    directory,
    clock: { now: () => NOW },
  } as never);

  return { deps, roles, accounts, sent, audit, accept, invitations };
}

describe('the employee role', () => {
  it('may read its own bookings and set up its own calendar, and nothing else', () => {
    expect(permissionsForRole('employee')).toEqual(['booking.read.own', 'booking.profile.own']);
  });

  it('may not configure, manage users or read the website', () => {
    const permissions = permissionsForRole('employee');
    for (const forbidden of ['booking.configure', 'user.read', 'user.manage', 'website.read']) {
      expect(permissions).not.toContain(forbidden);
    }
  });

  it('lets only an administrator manage users, and lets editors configure bookings', () => {
    expect(permissionsForRole('admin')).toContain('user.manage');
    expect(permissionsForRole('editor')).not.toContain('user.manage');
    expect(permissionsForRole('editor')).toContain('booking.configure');
  });
});

describe('ChangeUserRoles', () => {
  it('sets the roles of another member of the tenant', async () => {
    const { deps, roles } = world();

    const result = await new ChangeUserRoles(deps).execute({
      userId: 'editor-1',
      roles: ['viewer', 'employee'],
    });

    expect(result.isOk()).toBe(true);
    expect(roles.get(toActorId('editor-1'))).toEqual(['viewer', 'employee']);
  });

  it('refuses a person without user.manage before looking at the input', async () => {
    const { deps } = world({ actorRoles: ['editor'] });

    const result = await new ChangeUserRoles(deps).execute({ userId: 'nope', roles: ['x'] });

    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('never lets someone change their own roles', async () => {
    const { deps } = world();

    const result = await new ChangeUserRoles(deps).execute({
      userId: 'admin-1',
      roles: ['viewer'],
    });

    expect(result._unsafeUnwrapErr().code).toBe('auth.last_admin');
  });

  it('keeps the last administrator', async () => {
    const { deps, roles } = world();
    roles.delete(toActorId('admin-2'));
    roles.set(toActorId('editor-1'), ['admin']);
    roles.delete(ADMIN);
    roles.set(toActorId('admin-3'), ['admin']);

    // Two administrators remain (editor-1 and admin-3): demoting one is fine, the second is not.
    const first = await new ChangeUserRoles(deps).execute({
      userId: 'editor-1',
      roles: ['viewer'],
    });
    const second = await new ChangeUserRoles(deps).execute({
      userId: 'admin-3',
      roles: ['viewer'],
    });

    expect(first.isOk()).toBe(true);
    expect(second._unsafeUnwrapErr().code).toBe('auth.last_admin');
  });

  it('rejects an empty or unknown role set', async () => {
    const { deps } = world();

    const empty = await new ChangeUserRoles(deps).execute({ userId: 'editor-1', roles: [] });
    const unknown = await new ChangeUserRoles(deps).execute({
      userId: 'editor-1',
      roles: ['root'],
    });

    expect(empty.isErr()).toBe(true);
    expect(unknown.isErr()).toBe(true);
  });

  it('treats a member of another tenant like one that does not exist', async () => {
    const { deps } = world();

    const result = await new ChangeUserRoles(deps).execute({
      userId: 'stranger',
      roles: ['viewer'],
    });

    expect(result._unsafeUnwrapErr().code).toBe('auth.user_not_found');
  });
});

describe('RemoveUser', () => {
  it('takes a member out of the tenant but never yourself', async () => {
    const { deps, roles } = world();

    const removed = await new RemoveUser(deps).execute('editor-1');
    const self = await new RemoveUser(deps).execute('admin-1');

    expect(removed.isOk()).toBe(true);
    expect(roles.has(toActorId('editor-1'))).toBe(false);
    expect(self._unsafeUnwrapErr().code).toBe('auth.last_admin');
  });
});

describe('inviting and accepting', () => {
  it('emails a single-use link to a new address and stores only its hash', async () => {
    const { deps, sent, invitations } = world();

    const outcome = await new InviteUser(deps).execute({
      email: ' New@Example.org ',
      role: 'employee',
      locale: 'en',
    });

    expect(outcome._unsafeUnwrap()).toBe('invited');
    expect(sent).toEqual([{ to: 'new@example.org', token: 'token-1' }]);
    expect([...invitations.values()][0]?.tokenHash).toBe('hash:token-1');
  });

  it('gives an existing account the role at once instead of sending a link', async () => {
    const { deps, sent, roles } = world();

    const outcome = await new InviteUser(deps).execute({
      email: 'known@example.org',
      role: 'employee',
      locale: 'de',
    });

    expect(outcome._unsafeUnwrap()).toBe('granted');
    expect(sent).toEqual([]);
    expect(roles.get(toActorId('known-1'))).toEqual(['employee']);
  });

  it('lets only an administrator invite', async () => {
    const { deps } = world({ actorRoles: ['editor'] });

    const outcome = await new InviteUser(deps).execute({
      email: 'x@example.org',
      role: 'viewer',
      locale: 'en',
    });

    expect(outcome._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('creates the account with the invited role and burns the link', async () => {
    const { deps, accept, roles } = world();
    await new InviteUser(deps).execute({
      email: 'new@example.org',
      role: 'employee',
      locale: 'en',
    });

    const first = await accept.execute({
      token: 'token-1',
      name: 'Eve',
      password: 'a-long-password-1',
    });
    const second = await accept.execute({
      token: 'token-1',
      name: 'Eve',
      password: 'a-long-password-1',
    });

    expect(first.isOk()).toBe(true);
    expect(
      [...roles.entries()].some(([, held]) => held.length === 1 && held[0] === 'employee'),
    ).toBe(true);
    expect(second._unsafeUnwrapErr().code).toBe('auth.invalid_token');
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
    await new InviteUser(deps).execute({ email: 'new@example.org', role: 'viewer', locale: 'en' });

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
