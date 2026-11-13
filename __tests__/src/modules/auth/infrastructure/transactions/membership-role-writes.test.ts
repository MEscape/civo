import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { replaceMembershipRoles } from '@modules/auth/infrastructure/transactions/membership-role-writes';

const stored = vi.hoisted(() => new Set<string>());

vi.mock('@lib/db', () => {
  // A transaction-scoped membership store. These tests exercise baseline comparison and exact replacement;
  // PostgreSQL lock ordering and rollback are covered by prisma-membership.integration.test.ts.
  const collection = (filter: { id?: string; role?: string } = {}) => ({
    select: () => collection(filter),
    limit: () => collection(filter),
    all: async () => [...stored].map((role) => ({ id: role, role })),
    aggregate: async () => ({ total: stored.has('admin') ? 1 : 0 }),
    upsert: async ({ create }: { create: { role: string } }) => {
      stored.add(create.role);
    },
    deleteAndCount: async () => (filter.id === undefined ? 0 : Number(stored.delete(filter.id))),
  });
  const tx = {
    orm: { public: { Membership: { where: collection, select: () => collection() } } },
    query: async () => [{ id: 'site-1' }],
  };
  return {
    advisoryLock: async () => undefined,
    retryTransient: async (operation: () => Promise<unknown>) => operation(),
    db: {
      transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
      raw: { sql: () => ({ returnsRow: () => ({ build: () => ({}) }) }) },
    },
  };
});

const subject = toActorId('person');
const tenant = toTenantId('site-1');

describe('membership role replacement baselines', () => {
  it('reports last-administrator protection instead of a stale-edit conflict with a valid baseline', async () => {
    stored.add('admin');
    const demoted = await replaceMembershipRoles(subject, tenant, {
      expectedRoles: ['admin'],
      roles: ['viewer'],
    });
    expect(demoted).toBe('last_admin');
    const removed = await replaceMembershipRoles(subject, tenant, {
      expectedRoles: ['admin'],
      roles: [],
    });
    expect(removed).toBe('last_admin');
    expect([...stored]).toEqual(['admin']);
  });
  beforeEach(() => {
    stored.clear();
  });

  it('compares the roles visible to the editor while cleaning obsolete stored rows', async () => {
    stored.add('future_role');
    stored.add('viewer');

    expect(
      await replaceMembershipRoles(subject, tenant, {
        expectedRoles: ['viewer'],
        roles: ['editor'],
      }),
    ).toBe(true);
    expect([...stored]).toEqual(['editor']);
  });

  it('still refuses a stale known-role baseline without writing', async () => {
    stored.add('future_role');
    stored.add('editor');

    expect(
      await replaceMembershipRoles(subject, tenant, {
        expectedRoles: ['viewer'],
        roles: ['employee'],
      }),
    ).toBe(false);
    expect([...stored]).toEqual(['future_role', 'editor']);
  });

  it('allows explicit removal when only unknown-role rows remain', async () => {
    stored.add('future_role');

    expect(
      await replaceMembershipRoles(subject, tenant, {
        expectedRoles: [],
        roles: [],
      }),
    ).toBe(true);
    expect([...stored]).toEqual([]);
  });
});
