/**
 * Integration test of the membership and invitation persistence against a
 * REAL Postgres: what an in-memory fake cannot prove. Point
 * `BOOKING_TEST_DATABASE_URL` at a database with the migrations applied and
 * run `npm run test:integration`.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { PrismaInvitationRepository } from '@modules/auth/infrastructure/prisma/prisma-invitation.repository';
import { PrismaMembershipRepository } from '@modules/auth/infrastructure/prisma/prisma-membership.repository';

import { db, disconnectDb } from '@lib/db';

describe.skipIf(process.env['BOOKING_TEST_DATABASE_URL'] === undefined)(
  'auth persistence (real Postgres)',
  () => {
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = toTenantId(`it-auth-${suffix}`);
    const memberships = new PrismaMembershipRepository();
    const invitations = new PrismaInvitationRepository();
    const first = toActorId(`first-${suffix}`);
    const second = toActorId(`second-${suffix}`);
    const editor = toActorId(`editor-${suffix}`);

    afterAll(async () => {
      await db.orm.public.Membership.where({ tenantId }).deleteAndCount();
      await db.orm.public.Invitation.where({ tenantId }).deleteAndCount();
      await disconnectDb();
    });

    async function holdersOf(role: 'admin' | 'editor'): Promise<number> {
      const rows = await db.orm.public.Membership.where({ tenantId, role }).select('actorId').all();
      return rows.length;
    }

    it('lets only one of two administrators demote the other at the same moment', async () => {
      await memberships.replaceRoles(first, tenantId, ['admin']);
      await memberships.replaceRoles(second, tenantId, ['admin']);

      const [a, b] = await Promise.all([
        memberships.replaceRolesKeepingAdministrator(first, tenantId, ['editor']),
        memberships.replaceRolesKeepingAdministrator(second, tenantId, ['editor']),
      ]);

      expect([a._unsafeUnwrap(), b._unsafeUnwrap()].sort()).toEqual([false, true]);
      expect(await holdersOf('admin')).toBe(1);
    });

    it('lets only one of two administrators remove the other at the same moment', async () => {
      await memberships.replaceRoles(first, tenantId, ['admin']);
      await memberships.replaceRoles(second, tenantId, ['admin']);

      const [a, b] = await Promise.all([
        memberships.removeMemberKeepingAdministrator(first, tenantId),
        memberships.removeMemberKeepingAdministrator(second, tenantId),
      ]);

      expect([a._unsafeUnwrap(), b._unsafeUnwrap()].sort()).toEqual([false, true]);
      expect(await holdersOf('admin')).toBe(1);
    });

    it('refuses to remove the last administrator and removes anyone else', async () => {
      await memberships.replaceRoles(editor, tenantId, ['editor']);

      const lastAdmin = await memberships.removeMemberKeepingAdministrator(
        await soleAdmin(),
        tenantId,
      );
      expect(lastAdmin._unsafeUnwrap()).toBe(false);

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

    it('lets one request claim an invitation and the other none', async () => {
      const created = await invitations.create({
        tenantId,
        email: `invitee-${suffix}@example.org`,
        role: 'viewer',
        invitedBy: first,
        expiresAt: new Date(Date.now() + 60_000),
        tokenHash: `hash-${suffix}`,
      });
      const { id } = created._unsafeUnwrap();

      const claims = await Promise.all([
        invitations.claim(id, new Date()),
        invitations.claim(id, new Date()),
      ]);

      expect(claims.map((claim) => claim._unsafeUnwrap()).sort()).toEqual([false, true]);
    });

    it('never claims an expired invitation', async () => {
      const created = await invitations.create({
        tenantId,
        email: `late-${suffix}@example.org`,
        role: 'viewer',
        invitedBy: first,
        expiresAt: new Date(Date.now() - 1_000),
        tokenHash: `late-${suffix}`,
      });

      const claim = await invitations.claim(created._unsafeUnwrap().id, new Date());

      expect(claim._unsafeUnwrap()).toBe(false);
    });
  },
);
