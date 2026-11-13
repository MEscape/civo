/**
 * Integration test of the membership and invitation persistence against a
 * REAL Postgres: what an in-memory fake cannot prove. Needs the database of `DATABASE_URL` (see `vitest.integration.config.ts`) with the migrations
 * applied: `npm run test:integration`.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { PrismaMembershipRepository } from '@modules/auth/infrastructure/prisma/prisma-membership.repository';

import { db, disconnectDb } from '@lib/db';

describe('auth persistence (real Postgres)', () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const tenantId = toTenantId(`it-auth-${suffix}`);
  const memberships = new PrismaMembershipRepository();
  const first = toActorId(`first-${suffix}`);
  const second = toActorId(`second-${suffix}`);
  const editor = toActorId(`editor-${suffix}`);

  const otherTenant = toTenantId(`it-auth-other-${suffix}`);
  const createWebsite = (id: typeof tenantId) =>
    db.orm.public.Website.create({
      id,
      tenantId: id,
      name: 'Auth test',
      slug: id,
      templateKey: 'basic',
    });

  beforeEach(async () => {
    await db.orm.public.Membership.where({ tenantId }).deleteAndCount();
    await db.orm.public.Invitation.where({ tenantId }).deleteAndCount();
    // Tenant writes lock the website row, so the test tenants are real websites.
    await db.orm.public.Website.where((website) =>
      website.id.in([tenantId, otherTenant]),
    ).deleteAndCount();
    await createWebsite(tenantId);
    await createWebsite(otherTenant);
  });

  afterAll(async () => {
    await db.orm.public.Membership.where({ tenantId }).deleteAndCount();
    await db.orm.public.Invitation.where({ tenantId }).deleteAndCount();
    await db.orm.public.Membership.where({ tenantId: otherTenant }).deleteAndCount();
    await db.orm.public.Website.where((website) =>
      website.id.in([tenantId, otherTenant]),
    ).deleteAndCount();
    await disconnectDb();
  });

  async function holdersOf(role: 'admin' | 'editor'): Promise<number> {
    const rows = await db.orm.public.Membership.where({ tenantId, role }).select('actorId').all();
    return rows.length;
  }

  it('lets only one of two administrators demote the other at the same moment', async () => {
    await memberships.replaceRolesKeepingAdministrator(first, tenantId, { roles: ['admin'] });
    await memberships.replaceRolesKeepingAdministrator(second, tenantId, { roles: ['admin'] });

    const [a, b] = await Promise.all([
      memberships.replaceRolesKeepingAdministrator(first, tenantId, { roles: ['editor'] }),
      memberships.replaceRolesKeepingAdministrator(second, tenantId, { roles: ['editor'] }),
    ]);

    expect([a, b].map((result) => (result.isOk() ? result.value : result.error.code))).toEqual(
      expect.arrayContaining([true, 'auth.last_admin']),
    );
    expect(await holdersOf('admin')).toBe(1);
  });

  it('lets only one of two administrators remove the other at the same moment', async () => {
    await memberships.replaceRolesKeepingAdministrator(first, tenantId, { roles: ['admin'] });
    await memberships.replaceRolesKeepingAdministrator(second, tenantId, { roles: ['admin'] });

    const [a, b] = await Promise.all([
      memberships.removeMemberKeepingAdministrator(first, tenantId),
      memberships.removeMemberKeepingAdministrator(second, tenantId),
    ]);

    expect([a, b].map((result) => (result.isOk() ? result.value : result.error.code))).toEqual(
      expect.arrayContaining([true, 'auth.last_admin']),
    );
    expect(await holdersOf('admin')).toBe(1);
  });

  it('refuses to remove the last administrator and removes anyone else', async () => {
    await memberships.grantRole(first, tenantId, 'admin');
    await memberships.grantRole(editor, tenantId, 'editor');

    const lastAdmin = await memberships.removeMemberKeepingAdministrator(
      await soleAdmin(),
      tenantId,
    );
    expect(lastAdmin._unsafeUnwrapErr().code).toBe('auth.last_admin');

    const removed = await memberships.removeMemberKeepingAdministrator(editor, tenantId);
    expect(removed._unsafeUnwrap()).toBe(true);
    expect(await holdersOf('editor')).toBe(0);
  });

  async function soleAdmin() {
    const [row] = await db.orm.public.Membership.where({ tenantId, role: 'admin' })
      .select('actorId')
      .all();
    return toActorId(row?.actorId ?? '');
  }

  it('finds the tenants of a person, never the platform scope, and knows a platform administrator', async () => {
    const person = toActorId(`person-${suffix}`);
    const platformAdmin = toActorId(`platform-${suffix}`);
    const platform = toTenantId('platform');
    try {
      await memberships.replaceRolesKeepingAdministrator(person, tenantId, { roles: ['viewer'] });
      await memberships.replaceRolesKeepingAdministrator(person, otherTenant, {
        roles: ['editor'],
      });
      await db.orm.public.Membership.create({
        actorId: platformAdmin,
        tenantId: platform,
        role: 'platform_admin',
      });
      // The platform role belongs to the platform scope alone: the table refuses it inside a tenant.
      await expect(
        db.orm.public.Membership.create({
          actorId: person,
          tenantId,
          role: 'platform_admin',
        }),
      ).rejects.toThrow(/Membership_platform_rule/);

      expect((await memberships.findFirstTenant(person))._unsafeUnwrap()).toBe(tenantId);
      expect((await memberships.findFirstTenant(platformAdmin))._unsafeUnwrap()).toBeNull();
      expect((await memberships.findRoles(person, tenantId))._unsafeUnwrap()).toEqual(['viewer']);
      expect((await memberships.isPlatformAdmin(platformAdmin))._unsafeUnwrap()).toBe(true);
      expect((await memberships.isPlatformAdmin(person))._unsafeUnwrap()).toBe(false);
      // Platform administrators can be listed, added and removed; adding twice changes nothing.
      const another = toActorId(`another-${suffix}`);
      await memberships.grantPlatformAdmin(another);
      await memberships.grantPlatformAdmin(another);
      expect((await memberships.listPlatformAdmins(100))._unsafeUnwrap().ids).toContain(another);
      await memberships.revokePlatformAdmin(another, {
        actorId: platformAdmin,
        authority: 'membership',
      });
      expect((await memberships.listPlatformAdmins(100))._unsafeUnwrap().ids).not.toContain(
        another,
      );
      expect((await memberships.listPlatformAdmins(100))._unsafeUnwrap().ids).toContain(
        platformAdmin,
      );
    } finally {
      await db.orm.public.Membership.where({ actorId: platformAdmin }).deleteAndCount();
      await db.orm.public.Membership.where({ actorId: person }).deleteAndCount();
    }
  });
});
