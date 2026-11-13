import { describe, expect, it } from 'vitest';

import { RemoveUserAccess } from '@modules/auth/application/commands/remove-user-access';
import { SetUserAccess } from '@modules/auth/application/commands/set-user-access';
import { toActorId } from '@modules/auth/domain/models/ids';
import { permissionsForRole } from '@modules/auth/domain/models/role';

import { administrationWorld as world } from '../support/administration-world';

const ADMIN = toActorId('admin-1');

describe('the employee role', () => {
  it('may read its own bookings, set up its own calendar and take open bookings, and nothing else', () => {
    expect(permissionsForRole('employee')).toEqual([
      'booking.read.own',
      'booking.profile.own',
      'booking.claim.own',
    ]);
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

describe('setting website roles through shared access management', () => {
  it('sets the roles of another member of the tenant', async () => {
    const { deps, roles } = world();

    const result = await new SetUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'editor-1',
      roles: ['viewer', 'employee'],
    });

    expect(result.isOk()).toBe(true);
    expect(roles.get(toActorId('editor-1'))).toEqual(['viewer', 'employee']);
  });

  it('audits the new role set and, when the editor supplied a baseline, the previous one', async () => {
    const { deps, auditEvents } = world();

    await new SetUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'editor-1',
      roles: ['viewer'],
      expectedRoles: ['editor'],
    });
    await new SetUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'editor-1',
      roles: ['employee'],
    });

    expect(auditEvents).toEqual([
      {
        type: 'membership.roles_changed',
        actorId: ADMIN,
        tenantId: 'default',
        subjectId: 'editor-1',
        roles: ['viewer'],
        previousRoles: ['editor'],
      },
      {
        type: 'membership.roles_changed',
        actorId: ADMIN,
        tenantId: 'default',
        subjectId: 'editor-1',
        roles: ['employee'],
        previousRoles: undefined,
      },
    ]);
  });

  it('refuses a person without user.manage before looking at the input', async () => {
    const { deps } = world({ actorRoles: ['editor'] });

    const result = await new SetUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'nope',
      roles: ['x'],
    });

    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('never lets someone change their own roles', async () => {
    const { deps } = world();

    const result = await new SetUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'admin-1',
      roles: ['viewer'],
    });

    expect(result._unsafeUnwrapErr().code).toBe('auth.last_admin');
  });

  it('keeps the last administrator', async () => {
    const { deps, roles } = world({ actorRoles: ['platform_admin'] });
    roles.delete(toActorId('admin-2'));
    roles.set(toActorId('editor-1'), ['admin']);
    roles.delete(ADMIN);
    roles.set(toActorId('admin-3'), ['admin']);

    // Two administrators remain (editor-1 and admin-3): demoting one is fine, the second is not.
    const first = await new SetUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'editor-1',
      roles: ['viewer'],
    });
    const second = await new SetUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'admin-3',
      roles: ['viewer'],
    });

    expect(first.isOk()).toBe(true);
    expect(second._unsafeUnwrapErr().code).toBe('auth.last_admin');
  });

  it('rejects an empty or unknown role set', async () => {
    const { deps } = world();

    const empty = await new SetUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'editor-1',
      roles: [],
    });
    const unknown = await new SetUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'editor-1',
      roles: ['root'],
    });

    expect(empty.isErr()).toBe(true);
    expect(unknown.isErr()).toBe(true);
  });

  it('treats a member of another tenant like one that does not exist', async () => {
    const { deps } = world();

    const result = await new SetUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'stranger',
      roles: ['viewer'],
    });

    expect(result._unsafeUnwrapErr().code).toBe('auth.user_not_found');
  });
});

describe('removing website access through shared access management', () => {
  it('takes a member out of the tenant but never yourself', async () => {
    const { deps, roles } = world();

    const removed = await new RemoveUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'editor-1',
    });
    const self = await new RemoveUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'admin-1',
    });

    expect(removed.isOk()).toBe(true);
    expect(roles.has(toActorId('editor-1'))).toBe(false);
    expect(self._unsafeUnwrapErr().code).toBe('auth.last_admin');
  });

  it('audits the removed roles when the baseline was supplied and carries no email', async () => {
    const { deps, auditEvents } = world();

    await new RemoveUserAccess(deps).execute({
      tenantId: 'default',
      userId: 'editor-1',
      expectedRoles: ['editor'],
    });

    expect(auditEvents).toEqual([
      {
        type: 'membership.removed',
        actorId: ADMIN,
        tenantId: 'default',
        subjectId: 'editor-1',
        removedRoles: ['editor'],
      },
    ]);
    expect(JSON.stringify(auditEvents)).not.toContain('@');
  });
});
