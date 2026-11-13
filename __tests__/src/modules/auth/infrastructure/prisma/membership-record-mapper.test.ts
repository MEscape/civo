import { describe, expect, it } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import { PLATFORM_TENANT_ID } from '@modules/auth/domain/models/tenant';
import { MAX_TENANT_MEMBERS } from '@modules/auth/domain/ports/membership.repository';
import {
  toMemberRoster,
  toMembershipsByActor,
  toRoles,
} from '@modules/auth/infrastructure/prisma/membership-record-mapper';

describe('membership-record-mapper infrastructure mapper', () => {
  describe('toRoles', () => {
    it('filters recognized roles and discards unknown roles', () => {
      const records = [
        { role: 'admin' },
        { role: 'unknown_role' },
        { role: 'editor' },
        { role: 'bogus' },
      ];
      expect(toRoles(records)).toEqual(['admin', 'editor']);
    });
  });

  describe('toMembershipsByActor', () => {
    it('groups roles per tenant per actor and excludes platform tenant', () => {
      const records = [
        { actorId: 'user-1', tenantId: 'tenant-a', role: 'admin' },
        { actorId: 'user-1', tenantId: 'tenant-a', role: 'editor' },
        { actorId: 'user-1', tenantId: 'tenant-b', role: 'viewer' },
        { actorId: 'user-1', tenantId: PLATFORM_TENANT_ID, role: 'platform_admin' },
        { actorId: 'user-2', tenantId: 'tenant-a', role: 'editor' },
        { actorId: 'user-2', tenantId: 'tenant-a', role: 'invalid_role' },
      ];

      const result = toMembershipsByActor(records);
      expect(result.size).toBe(2);

      const user1 = result.get(toActorId('user-1'));
      expect(user1).toEqual([
        { tenantId: 'tenant-a', roles: ['admin', 'editor'] },
        { tenantId: 'tenant-b', roles: ['viewer'] },
      ]);

      const user2 = result.get(toActorId('user-2'));
      expect(user2).toEqual([{ tenantId: 'tenant-a', roles: ['editor'] }]);
    });
  });

  describe('toMemberRoster', () => {
    it('builds member roster with aggregated roles', () => {
      const records = [
        { actorId: 'user-1', role: 'admin' },
        { actorId: 'user-1', role: 'editor' },
        { actorId: 'user-2', role: 'viewer' },
      ];

      const roster = toMemberRoster(records);
      expect(roster.isTruncated).toBe(false);
      expect(roster.members.size).toBe(2);
      expect(roster.members.get(toActorId('user-1'))).toEqual(['admin', 'editor']);
      expect(roster.members.get(toActorId('user-2'))).toEqual(['viewer']);
    });

    it('keeps every known role of the selected people and ignores unknown data', () => {
      const roster = toMemberRoster([
        { actorId: 'user-1', role: 'admin' },
        { actorId: 'user-1', role: 'viewer' },
        { actorId: 'unknown', role: 'future_role' },
      ]);
      expect(roster.members.get(toActorId('user-1'))).toEqual(['admin', 'viewer']);
      expect(roster.members.has(toActorId('unknown'))).toBe(false);
    });

    it('does not report truncation at the exact member limit, including multiple roles', () => {
      const records = Array.from({ length: MAX_TENANT_MEMBERS }, (_, i) => [
        { actorId: `user-${i}`, role: 'admin' },
        { actorId: `user-${i}`, role: 'editor' },
      ]).flat();
      const roster = toMemberRoster(records);
      expect(roster.members.size).toBe(MAX_TENANT_MEMBERS);
      expect(roster.isTruncated).toBe(false);
    });

    it('detects truncation when member count exceeds MAX_TENANT_MEMBERS', () => {
      const records = Array.from({ length: MAX_TENANT_MEMBERS + 10 }, (_, i) => ({
        actorId: `user-${i}`,
        role: 'editor',
      }));

      const roster = toMemberRoster(records);
      expect(roster.isTruncated).toBe(true);
      expect(roster.members.size).toBe(MAX_TENANT_MEMBERS);
    });
  });
});
