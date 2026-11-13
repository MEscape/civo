import { createHash, randomUUID } from 'node:crypto';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import type { Actor } from '@modules/auth/domain/models/actor';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { ActorId, TenantId } from '@modules/auth/domain/models/ids';
import { PLATFORM_TENANT_ID } from '@modules/auth/domain/models/tenant';
import { PrismaInvitationRepository } from '@modules/auth/infrastructure/prisma/prisma-invitation.repository';
import { PrismaMembershipRepository } from '@modules/auth/infrastructure/prisma/prisma-membership.repository';

import { db, disconnectDb } from '@lib/db';

describe('membership integrity and bounded relation reads (real Postgres)', () => {
  const members = new PrismaMembershipRepository();
  const actors: ActorId[] = [];
  const websites: TenantId[] = [];
  const actor = (prefix: string) => {
    const id = toActorId(`${prefix}-${randomUUID()}`);
    actors.push(id);
    return id;
  };
  /** Tenant writes lock the website row, so every test tenant is a real website. */
  const tenant = async () => {
    const id = toTenantId(randomUUID());
    websites.push(id);
    await db.orm.public.Website.create({
      id,
      tenantId: id,
      name: 'Membership test',
      slug: id,
      templateKey: 'basic',
    });
    return id;
  };

  afterEach(async () => {
    await db.orm.public.Invitation.where((invitation) =>
      invitation.invitedBy.in(actors),
    ).deleteAndCount();
    await db.orm.public.Membership.where((membership) =>
      membership.actorId.in(actors),
    ).deleteAndCount();
    actors.length = 0;
    await db.orm.public.Website.where((website) => website.id.in(websites)).deleteAndCount();
    websites.length = 0;
  });
  afterAll(disconnectDb);

  it('distinguishes sole-admin protection from stale edits and allows demotion with another admin', async () => {
    const person = actor('sole-admin');
    const backup = actor('backup-admin');
    const site = await tenant();
    (await members.grantRole(person, site, 'admin'))._unsafeUnwrap();
    const demoted = await members.replaceRolesKeepingAdministrator(person, site, {
      expectedRoles: ['admin'],
      roles: ['viewer'],
    });
    expect(demoted._unsafeUnwrapErr().code).toBe('auth.last_admin');
    const refused = await members.removeMemberKeepingAdministrator(person, site, {
      expectedRoles: ['admin'],
    });
    expect(refused._unsafeUnwrapErr().code).toBe('auth.last_admin');
    (await members.grantRole(backup, site, 'admin'))._unsafeUnwrap();
    expect(
      (
        await members.replaceRolesKeepingAdministrator(person, site, {
          expectedRoles: ['admin'],
          roles: ['viewer'],
        })
      )._unsafeUnwrap(),
    ).toBe(true);
    expect(
      (
        await members.removeMemberKeepingAdministrator(person, site, { expectedRoles: ['admin'] })
      )._unsafeUnwrap(),
    ).toBe(false);
    expect(
      (
        await members.removeMemberKeepingAdministrator(person, site, { expectedRoles: ['viewer'] })
      )._unsafeUnwrap(),
    ).toBe(true);
  });

  it('rejects obsolete roles at the database boundary and replaces a valid visible baseline', async () => {
    const person = actor('legacy-roles');
    const site = await tenant();
    await expect(
      db.orm.public.Membership.create({
        actorId: person,
        tenantId: site,
        role: 'future_role' as never,
      }),
    ).rejects.toThrow(/Membership_role_check/);
    (await members.grantRole(person, site, 'viewer'))._unsafeUnwrap();

    const changed = await members.replaceRolesKeepingAdministrator(person, site, {
      expectedRoles: ['viewer'],
      roles: ['editor'],
    });

    expect(changed._unsafeUnwrap()).toBe(true);
    expect((await members.findRoles(person, site))._unsafeUnwrap()).toEqual(['editor']);
    expect(
      await db.orm.public.Membership.where({ actorId: person, tenantId: site })
        .select('role')
        .all(),
    ).toEqual([{ role: 'editor' }]);
  });

  it('adds concurrent invitation roles without replacing existing roles', async () => {
    const person = actor('additive');
    const site = await tenant();
    (await members.grantRole(person, site, 'admin'))._unsafeUnwrap();
    const results = await Promise.all([
      members.grantRole(person, site, 'employee'),
      members.grantRole(person, site, 'viewer'),
      members.grantRole(person, site, 'employee'),
    ]);
    expect(results.every((result) => result.isOk())).toBe(true);
    expect([...(await members.findRoles(person, site))._unsafeUnwrap()].sort()).toEqual([
      'admin',
      'employee',
      'viewer',
    ]);
  });

  it('bounds filtered people after deduplicating all their website memberships', async () => {
    const first = actor('a');
    const second = actor('b');
    const third = actor('c');
    for (let index = 0; index < 6; index += 1) {
      (await members.grantRole(first, await tenant(), 'viewer'))._unsafeUnwrap();
    }
    (await members.grantRole(second, await tenant(), 'viewer'))._unsafeUnwrap();
    (await members.grantRole(third, await tenant(), 'viewer'))._unsafeUnwrap();
    const found = (
      await members.findMemberIds({ tenantId: null, role: 'viewer' }, 2)
    )._unsafeUnwrap();
    expect(found.ids).toEqual([first, second]);
    expect(found.isTruncated).toBe(true);
  });

  it('keeps complete role sets when narrowing a website roster by role', async () => {
    const person = actor('filtered');
    const excluded = actor('excluded');
    const site = await tenant();
    (await members.grantRole(person, site, 'admin'))._unsafeUnwrap();
    (await members.grantRole(person, site, 'viewer'))._unsafeUnwrap();
    (await members.grantRole(excluded, site, 'editor'))._unsafeUnwrap();
    const roster = (await members.listMembers(site, { role: 'viewer' }))._unsafeUnwrap();
    expect([...roster.members.keys()]).toEqual([person]);
    expect([...(roster.members.get(person) ?? [])].sort()).toEqual(['admin', 'viewer']);
    expect(roster.isTruncated).toBe(false);
  });

  it('loads more than fifty role rows without hiding website grants', async () => {
    const person = actor('many-grants');
    const sites: TenantId[] = [];
    for (let index = 0; index < 20; index += 1) {
      const site = await tenant();
      sites.push(site);
      for (const role of ['admin', 'viewer', 'employee'] as const) {
        (await members.grantRole(person, site, role))._unsafeUnwrap();
      }
    }
    const grants = (await members.listMembershipsOf([person]))._unsafeUnwrap().get(person);
    expect(grants).toHaveLength(sites.length);
    expect(grants?.every((grant) => grant.roles.length === 3)).toBe(true);
    expect(new Set(grants?.map((grant) => grant.tenantId))).toEqual(new Set(sites));
  });
  it('lets only one of two platform administrators revoke the other concurrently', async () => {
    const first = actor('platform-a');
    const second = actor('platform-b');
    (await members.grantPlatformAdmin(first))._unsafeUnwrap();
    (await members.grantPlatformAdmin(second))._unsafeUnwrap();
    const results = await Promise.all([
      members.revokePlatformAdmin(second, { actorId: first, authority: 'membership' }),
      members.revokePlatformAdmin(first, { actorId: second, authority: 'membership' }),
    ]);
    expect(results.map((result) => result._unsafeUnwrap()).sort()).toEqual([false, true]);
    const remaining = await Promise.all([
      members.isPlatformAdmin(first),
      members.isPlatformAdmin(second),
    ]);
    expect(remaining.filter((result) => result._unsafeUnwrap())).toHaveLength(1);
  });

  it('allows configured bootstrap authority to remove a membership independently of stored roles', async () => {
    const bootstrap = actor('configured-bootstrap');
    const target = actor('platform-target');
    (await members.grantPlatformAdmin(target))._unsafeUnwrap();
    expect(
      (
        await members.revokePlatformAdmin(target, { actorId: bootstrap, authority: 'bootstrap' })
      )._unsafeUnwrap(),
    ).toBe(true);
    expect((await members.isPlatformAdmin(target))._unsafeUnwrap()).toBe(false);
  });

  it('filters authorized website IDs before person limits and never returns unrelated memberships', async () => {
    const allowed = actor('z-authorized');
    const unrelated = actor('a-unrelated');
    const first = await tenant();
    const second = await tenant();
    const hidden = await tenant();
    (await members.grantRole(allowed, first, 'editor'))._unsafeUnwrap();
    (await members.grantRole(allowed, second, 'viewer'))._unsafeUnwrap();
    (await members.grantRole(allowed, hidden, 'admin'))._unsafeUnwrap();
    (await members.grantRole(unrelated, hidden, 'editor'))._unsafeUnwrap();
    const found = (
      await members.findMemberIds({ tenantId: null, tenantIds: [first, second], role: null }, 1)
    )._unsafeUnwrap();
    expect(found).toEqual({ ids: [allowed], isTruncated: false });
    const grants = (
      await members.listMembershipsOf([allowed, unrelated], [first, second])
    )._unsafeUnwrap();
    expect(new Set(grants.get(allowed)?.map((membership) => membership.tenantId))).toEqual(
      new Set([first, second]),
    );
    expect(grants.has(unrelated)).toBe(false);
    expect(
      (
        await members.findMemberIds({ tenantId: null, tenantIds: [], role: null }, 1)
      )._unsafeUnwrap(),
    ).toEqual({ ids: [], isTruncated: false });
    expect((await members.listMembershipsOf([allowed], []))._unsafeUnwrap().size).toBe(0);
  });

  it('allows only one concurrent replacement of the same observed role baseline', async () => {
    const manager = actor('cas-manager');
    const person = actor('cas-person');
    const site = await tenant();
    (await members.grantRole(manager, site, 'admin'))._unsafeUnwrap();
    (await members.grantRole(person, site, 'viewer'))._unsafeUnwrap();
    const acting: Actor = { id: manager, tenantId: site, roles: ['admin'] };
    const results = await Promise.all([
      members.replaceRolesKeepingAdministrator(person, site, {
        roles: ['editor'],
        actor: acting,
        expectedRoles: ['viewer'],
      }),
      members.replaceRolesKeepingAdministrator(person, site, {
        roles: ['contributor'],
        actor: acting,
        expectedRoles: ['viewer'],
      }),
    ]);
    const changed = results.map((result) => result._unsafeUnwrap());
    expect([...changed].sort()).toEqual([false, true]);
    expect((await members.findRoles(person, site))._unsafeUnwrap()).toEqual(
      changed[0] ? ['editor'] : ['contributor'],
    );
  });

  it('rejects a queued manager write after live membership revocation', async () => {
    const manager = actor('revoked-manager');
    const backup = actor('remaining-manager');
    const person = actor('managed-person');
    const site = await tenant();
    (await members.grantRole(manager, site, 'admin'))._unsafeUnwrap();
    (await members.grantRole(backup, site, 'admin'))._unsafeUnwrap();
    (await members.grantRole(person, site, 'viewer'))._unsafeUnwrap();
    const staleActor: Actor = { id: manager, tenantId: site, roles: ['admin'] };
    expect((await members.removeMemberKeepingAdministrator(manager, site))._unsafeUnwrap()).toBe(
      true,
    );
    const changed = await members.replaceRolesKeepingAdministrator(person, site, {
      roles: ['editor'],
      actor: staleActor,
      expectedRoles: ['viewer'],
    });
    expect(changed._unsafeUnwrap()).toBe(false);
    expect((await members.findRoles(person, site))._unsafeUnwrap()).toEqual(['viewer']);
  });

  it('rejects a revoked platform administrator granting platform or website access from a stale actor', async () => {
    const administrator = actor('revoked-platform');
    const bootstrap = actor('bootstrap');
    const person = actor('new-admin-target');
    const site = await tenant();
    (await members.grantPlatformAdmin(administrator))._unsafeUnwrap();
    const staleActor: Actor = {
      id: administrator,
      tenantId: PLATFORM_TENANT_ID,
      roles: ['platform_admin'],
      platformAuthority: 'membership',
    };
    expect(
      (
        await members.revokePlatformAdmin(administrator, {
          actorId: bootstrap,
          authority: 'bootstrap',
        })
      )._unsafeUnwrap(),
    ).toBe(true);
    expect((await members.grantPlatformAdmin(person, { actor: staleActor }))._unsafeUnwrap()).toBe(
      false,
    );
    expect((await members.isPlatformAdmin(person))._unsafeUnwrap()).toBe(false);
    expect(
      (
        await members.replaceRolesKeepingAdministrator(person, site, {
          roles: ['admin'],
          actor: staleActor,
          expectedRoles: [],
        })
      )._unsafeUnwrap(),
    ).toBe(false);
    expect((await members.findRoles(person, site))._unsafeUnwrap()).toEqual([]);
  });

  it.each([
    { change: 'demoted', roles: ['viewer'] as const },
    { change: 'removed', roles: [] as const },
  ])('invalidates a pending offer when access is directly $change', async ({ roles }) => {
    const inviter = actor('pending-inviter');
    const person = actor('pending-recipient');
    const site = await tenant();
    (await members.grantRole(inviter, site, 'admin'))._unsafeUnwrap();
    const now = new Date('2030-01-01T12:00:00Z');
    const email = `${person}@example.org`;
    const tokenHash = createHash('sha256').update(`${site}:${person}`).digest('hex');
    const invitations = new PrismaInvitationRepository();
    const invitation = (
      await invitations.createPending(
        {
          tenantId: site,
          email,
          role: 'admin',
          invitedBy: inviter,
          expiresAt: new Date('2030-01-08T12:00:00Z'),
          tokenHash,
        },
        now,
      )
    )._unsafeUnwrap();
    if (invitation === null) {
      throw new Error('Expected a pending invitation.');
    }
    (await members.grantRole(person, site, 'editor'))._unsafeUnwrap();
    const replaced = await members.replaceRolesKeepingAdministrator(person, site, {
      roles,
      expectedRoles: ['editor'],
      subjectEmail: email,
      actor: { id: inviter, tenantId: site, roles: ['admin'] },
    });
    expect(replaced._unsafeUnwrap()).toBe(true);
    expect((await invitations.countOpen(site, now))._unsafeUnwrap()).toBe(0);
    expect(
      (
        await invitations.accept({
          id: invitation.id,
          actorId: person,
          now,
          bootstrapAuthority: false,
        })
      )._unsafeUnwrap(),
    ).toBe('unavailable');
    expect((await members.findRoles(person, site))._unsafeUnwrap()).toEqual(roles);
  });
});
