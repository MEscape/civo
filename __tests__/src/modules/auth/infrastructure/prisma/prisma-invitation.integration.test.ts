import { createHash, randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { ActorId, TenantId } from '@modules/auth/domain/models/ids';
import type { NewInvitation } from '@modules/auth/domain/ports/invitation.repository';
import { PrismaInvitationRepository } from '@modules/auth/infrastructure/prisma/prisma-invitation.repository';
import { PrismaMembershipRepository } from '@modules/auth/infrastructure/prisma/prisma-membership.repository';

import { db, disconnectDb } from '@lib/db';

const NOW = new Date('2030-01-01T12:00:00Z');
const EXPIRES = new Date('2030-01-08T12:00:00Z');
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

describe('invitation creation and atomic acceptance (real Postgres)', () => {
  const repository = new PrismaInvitationRepository();
  const members = new PrismaMembershipRepository();
  let tenantId: TenantId;
  let inviter: ActorId;
  let recipient: ActorId;

  beforeEach(async () => {
    tenantId = toTenantId(`it-invite-${randomUUID()}`);
    inviter = toActorId(`inviter-${randomUUID()}`);
    recipient = toActorId(`recipient-${randomUUID()}`);
    await db.orm.public.Website.create({
      id: tenantId,
      tenantId,
      name: 'Invitation test',
      slug: tenantId,
      templateKey: 'basic',
    });
    (await members.grantRole(inviter, tenantId, 'admin'))._unsafeUnwrap();
  });
  afterEach(async () => {
    await db.orm.public.Invitation.where({ invitedBy: inviter }).deleteAndCount();
    await db.orm.public.Membership.where((record) =>
      record.actorId.in([inviter, recipient]),
    ).deleteAndCount();
    await db.orm.public.Website.where({ id: tenantId }).deleteAndCount();
  });
  afterAll(disconnectDb);

  function offer(label: string, email = 'ada@example.org'): NewInvitation {
    return {
      tenantId,
      email,
      role: 'viewer',
      invitedBy: inviter,
      expiresAt: EXPIRES,
      tokenHash: digest(`${tenantId}:${label}`),
    };
  }
  async function pending(draft: NewInvitation) {
    const created = (await repository.createPending(draft, NOW))._unsafeUnwrap();
    if (created === null) {
      throw new Error('Expected a new pending invitation');
    }
    return created;
  }

  it('preserves the original link when a second offer is already pending, regardless of role', async () => {
    const original = await pending(offer('original'));
    expect(
      (await repository.createPending({ ...offer('new'), role: 'admin' }, NOW))._unsafeUnwrap(),
    ).toBeNull();
    expect(
      (await repository.findByTokenHash(offer('original').tokenHash))._unsafeUnwrap()?.id,
    ).toBe(original.id);
    expect((await repository.countOpen(tenantId, NOW))._unsafeUnwrap()).toBe(1);
  });

  it('serializes competing invitations from different managers and different offered roles', async () => {
    const results = await Promise.all([
      repository.createPending(offer('a'), NOW),
      repository.createPending({ ...offer('b'), role: 'editor' }, NOW),
    ]);
    expect(
      results.map((result) => result._unsafeUnwrap()).filter((entry) => entry !== null),
    ).toHaveLength(1);
    expect((await repository.countOpen(tenantId, NOW))._unsafeUnwrap()).toBe(1);
  });

  it('allows a fresh invitation after expiry while preserving the expired history', async () => {
    const expired = await pending({ ...offer('expired'), expiresAt: NOW });
    expect((await repository.createPending(offer('fresh'), NOW))._unsafeUnwrap()).not.toBeNull();
    expect((await repository.findByTokenHash(offer('expired').tokenHash))._unsafeUnwrap()?.id).toBe(
      expired.id,
    );
    expect((await repository.countOpen(tenantId, NOW))._unsafeUnwrap()).toBe(1);
  });

  it('grants membership and consumes the invitation atomically, once under concurrent acceptance', async () => {
    const invitation = await pending(offer('accept'));
    const input = { id: invitation.id, actorId: recipient, now: NOW, bootstrapAuthority: false };
    const accepted = await Promise.all([repository.accept(input), repository.accept(input)]);
    expect(accepted.map((result) => result._unsafeUnwrap()).sort()).toEqual([
      'accepted',
      'already_member',
    ]);
    expect((await members.findRoles(recipient, tenantId))._unsafeUnwrap()).toEqual(['viewer']);
    expect(
      (await repository.findByTokenHash(offer('accept').tokenHash))._unsafeUnwrap()?.acceptedAt,
    ).toEqual(NOW);
  });

  it('rolls back invitation consumption when the membership write fails', async () => {
    const invitation = await pending(offer('rollback'));
    const result = await repository.accept({
      id: invitation.id,
      actorId: toActorId('x'.repeat(129)),
      now: NOW,
      bootstrapAuthority: false,
    });
    expect(result._unsafeUnwrapErr().kind).toBe('infrastructure');
    expect(
      (await repository.findByTokenHash(offer('rollback').tokenHash))._unsafeUnwrap()?.acceptedAt,
    ).toBeNull();
    expect((await repository.countOpen(tenantId, NOW))._unsafeUnwrap()).toBe(1);
  });

  it('lists the invited admin role immediately after acceptance', async () => {
    const invitation = await pending({ ...offer('admin'), role: 'admin' });
    expect(
      (
        await repository.accept({
          id: invitation.id,
          actorId: recipient,
          now: NOW,
          bootstrapAuthority: false,
        })
      )._unsafeUnwrap(),
    ).toBe('accepted');
    expect((await members.findRoles(recipient, tenantId))._unsafeUnwrap()).toEqual(['admin']);
    expect((await members.listMembershipsOf([recipient]))._unsafeUnwrap().get(recipient)).toEqual([
      { tenantId, roles: ['admin'] },
    ]);
  });

  it('refuses revoked, expired, deleted-website and revoked-inviter offers without granting access', async () => {
    const revoked = await pending(offer('revoked'));
    await repository.revoke(revoked.id, tenantId);
    expect(
      (
        await repository.accept({
          id: revoked.id,
          actorId: recipient,
          now: NOW,
          bootstrapAuthority: false,
        })
      )._unsafeUnwrap(),
    ).toBe('unavailable');
    const expired = await pending({ ...offer('expired'), expiresAt: NOW });
    expect(
      (
        await repository.accept({
          id: expired.id,
          actorId: recipient,
          now: NOW,
          bootstrapAuthority: false,
        })
      )._unsafeUnwrap(),
    ).toBe('unavailable');
    const current = await pending(offer('authority'));
    await db.orm.public.Membership.where({ actorId: inviter, tenantId }).deleteAndCount();
    expect(
      (
        await repository.accept({
          id: current.id,
          actorId: recipient,
          now: NOW,
          bootstrapAuthority: false,
        })
      )._unsafeUnwrap(),
    ).toBe('unavailable');
    await members.grantRole(inviter, tenantId, 'admin');
    await db.orm.public.Website.where({ id: tenantId }).deleteAndCount();
    expect(
      (
        await repository.accept({
          id: current.id,
          actorId: recipient,
          now: NOW,
          bootstrapAuthority: false,
        })
      )._unsafeUnwrap(),
    ).toBe('unavailable');
    expect((await members.findRoles(recipient, tenantId))._unsafeUnwrap()).toEqual([]);
  });

  it('requires live platform authority for platform offers and grants no website role', async () => {
    const invitation = await pending({
      ...offer('platform'),
      tenantId: toTenantId('platform'),
      role: 'platform_admin',
    });
    const input = { id: invitation.id, actorId: recipient, now: NOW, bootstrapAuthority: false };
    expect((await repository.accept(input))._unsafeUnwrap()).toBe('unavailable');
    await members.grantPlatformAdmin(inviter);
    expect((await repository.accept(input))._unsafeUnwrap()).toBe('accepted');
    expect((await members.isPlatformAdmin(recipient))._unsafeUnwrap()).toBe(true);
    expect((await members.findRoles(recipient, tenantId))._unsafeUnwrap()).toEqual([]);
  });

  it('reports already_member, consumes the offer and never overwrites or widens an existing role', async () => {
    await members.grantRole(recipient, tenantId, 'viewer');
    const invitation = await pending({ ...offer('existing'), role: 'admin' });
    const input = { id: invitation.id, actorId: recipient, now: NOW, bootstrapAuthority: false };
    expect((await repository.accept(input))._unsafeUnwrap()).toBe('already_member');
    expect((await members.findRoles(recipient, tenantId))._unsafeUnwrap()).toEqual(['viewer']);
    expect(
      (await repository.findByTokenHash(offer('existing').tokenHash))._unsafeUnwrap()?.acceptedAt,
    ).not.toBeNull();
  });

  it('answers a consumed offer as already_member only for an account that still holds access in its scope', async () => {
    const invitation = await pending(offer('repeat'));
    const input = { id: invitation.id, actorId: recipient, now: NOW, bootstrapAuthority: false };
    expect((await repository.accept(input))._unsafeUnwrap()).toBe('accepted');
    expect((await repository.accept(input))._unsafeUnwrap()).toBe('already_member');
    expect(
      (
        await repository.accept({ ...input, actorId: toActorId(`stranger-${randomUUID()}`) })
      )._unsafeUnwrap(),
    ).toBe('unavailable');
    await db.orm.public.Membership.where({ actorId: recipient, tenantId }).deleteAndCount();
    expect((await repository.accept(input))._unsafeUnwrap()).toBe('unavailable');
  });

  it('reports a repeated platform acceptance as already_member', async () => {
    await members.grantPlatformAdmin(inviter);
    const invitation = await pending({
      ...offer('platform-repeat'),
      tenantId: toTenantId('platform'),
      role: 'platform_admin',
    });
    const input = { id: invitation.id, actorId: recipient, now: NOW, bootstrapAuthority: false };
    expect((await repository.accept(input))._unsafeUnwrap()).toBe('accepted');
    expect((await repository.accept(input))._unsafeUnwrap()).toBe('already_member');
  });

  it('withdraws the open offers of a manager who loses user.manage, in that website only', async () => {
    const other = toTenantId(`it-invite-other-${randomUUID()}`);
    const manager = toActorId(`manager-${randomUUID()}`);
    await db.orm.public.Website.create({
      id: other,
      tenantId: other,
      name: 'Other',
      slug: other,
      templateKey: 'basic',
    });
    await members.grantRole(inviter, other, 'admin');
    await members.grantRole(manager, tenantId, 'admin');
    try {
      await pending(offer('mine', 'mine@example.org'));
      await pending({ ...offer('elsewhere', 'elsewhere@example.org'), tenantId: other });
      await pending({ ...offer('manager', 'manager@example.org'), invitedBy: manager });
      (
        await members.replaceRolesKeepingAdministrator(inviter, tenantId, { roles: ['viewer'] })
      )._unsafeUnwrap();
      expect(
        (await repository.findByTokenHash(offer('mine').tokenHash))._unsafeUnwrap(),
      ).toBeNull();
      expect(
        (await repository.findByTokenHash(offer('elsewhere').tokenHash))._unsafeUnwrap(),
      ).not.toBeNull();
      expect(
        (await repository.findByTokenHash(offer('manager').tokenHash))._unsafeUnwrap(),
      ).not.toBeNull();
    } finally {
      await db.orm.public.Invitation.where({ tenantId: other }).deleteAndCount();
      await db.orm.public.Invitation.where({ invitedBy: manager }).deleteAndCount();
      await db.orm.public.Membership.where((record) =>
        record.actorId.in([manager]),
      ).deleteAndCount();
      await db.orm.public.Membership.where({ tenantId: other }).deleteAndCount();
      await db.orm.public.Website.where({ id: other }).deleteAndCount();
    }
  });

  it('keeps the offers of a person who still manages users, and bootstrap offers', async () => {
    const platform = toTenantId('platform');
    await pending(offer('stays', 'stays@example.org'));
    const bootstrap = await pending({
      ...offer('bootstrap', 'boot@example.org'),
      tenantId: platform,
      role: 'platform_admin',
      invitedBy: toActorId('system'),
    });
    try {
      (
        await members.replaceRolesKeepingAdministrator(inviter, tenantId, {
          roles: ['admin', 'viewer'],
        })
      )._unsafeUnwrap();
      expect((await repository.countOpen(tenantId, NOW))._unsafeUnwrap()).toBe(1);
      expect(
        (await repository.findByTokenHash(offer('bootstrap').tokenHash))._unsafeUnwrap()?.id,
      ).toBe(bootstrap.id);
    } finally {
      await db.orm.public.Invitation.where({ id: bootstrap.id }).deleteAndCount();
    }
  });

  it('withdraws the platform offers of a revoked platform administrator, not bootstrap ones', async () => {
    const root = toActorId(`root-${randomUUID()}`);
    const platform = toTenantId('platform');
    await members.grantPlatformAdmin(inviter);
    await members.grantPlatformAdmin(root);
    await pending({
      ...offer('platform-mine', 'pm@example.org'),
      tenantId: platform,
      role: 'platform_admin',
    });
    const bootstrap = await pending({
      ...offer('platform-boot', 'pb@example.org'),
      tenantId: platform,
      role: 'platform_admin',
      invitedBy: toActorId('system'),
    });
    try {
      (
        await members.revokePlatformAdmin(inviter, { actorId: root, authority: 'membership' })
      )._unsafeUnwrap();
      expect(
        (await repository.findByTokenHash(offer('platform-mine').tokenHash))._unsafeUnwrap(),
      ).toBeNull();
      expect(
        (await repository.findByTokenHash(offer('platform-boot').tokenHash))._unsafeUnwrap()?.id,
      ).toBe(bootstrap.id);
    } finally {
      await db.orm.public.Invitation.where({ id: bootstrap.id }).deleteAndCount();
      await db.orm.public.Membership.where({ actorId: root }).deleteAndCount();
    }
  });

  it('writes nothing for a website that is gone, so no orphan membership remains', async () => {
    await db.orm.public.Website.where({ id: tenantId }).deleteAndCount();
    const replaced = await members.replaceRolesKeepingAdministrator(recipient, tenantId, {
      roles: ['viewer'],
    });
    expect(replaced._unsafeUnwrap()).toBe(false);
    (await members.grantRole(recipient, tenantId, 'viewer'))._unsafeUnwrap();
    expect((await members.findRoles(recipient, tenantId))._unsafeUnwrap()).toEqual([]);
  });

  it('uses the same scope for invitation totals, rows and pages', async () => {
    await pending(offer('first', 'first@example.org'));
    await pending(offer('second', 'second@example.org'));
    await pending({
      ...offer('platform'),
      tenantId: toTenantId('platform'),
      role: 'platform_admin',
    });
    const found = (
      await repository.listOpenForTenants([tenantId], NOW, { page: 2, pageSize: 1 })
    )._unsafeUnwrap();
    expect(found.total).toBe(2);
    expect(found.items).toHaveLength(1);
    expect(found.items[0]?.tenantId).toBe(tenantId);
    expect(
      (await repository.listOpenForTenants([], NOW, { page: 1, pageSize: 1 }))._unsafeUnwrap()
        .total,
    ).toBe(0);
  });
});
