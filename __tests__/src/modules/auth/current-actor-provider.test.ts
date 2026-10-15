import { describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { Role } from '@modules/auth/domain/models/role';
import { PLATFORM_TENANT_ID, UNASSIGNED_TENANT_ID } from '@modules/auth/domain/models/tenant';
import type { MembershipRepository } from '@modules/auth/domain/ports/membership.repository';
import { BetterAuthCurrentActorProvider } from '@modules/auth/infrastructure/better-auth/better-auth-current-actor-provider';
import { DevCurrentActorProvider } from '@modules/auth/infrastructure/dev/dev-current-actor-provider';

import { okAsync } from '@lib/result';

const NOW = new Date('2027-01-01T12:00:00Z');
const T1 = toTenantId('site-1');
const T2 = toTenantId('site-2');

interface Person {
  readonly email?: string;
  readonly emailVerified?: boolean;
  /** tenant -> roles, in the order the memberships were created */
  readonly memberships?: ReadonlyArray<readonly [string, readonly string[]]>;
  readonly platformMembership?: boolean;
}

function providerFor(
  person: Person,
  hint: string | null | (() => Promise<string | null>),
  emails: string[] = [],
) {
  const memberships = {
    isPlatformAdmin: () => okAsync(person.platformMembership === true),
    findTenantsOf: () => okAsync((person.memberships ?? []).map(([tenant]) => toTenantId(tenant))),
    findRoles: (_actor: unknown, tenant: string) =>
      okAsync(
        ((person.memberships ?? []).find(([candidate]) => candidate === tenant)?.[1] ??
          []) as Role[],
      ),
  } as unknown as MembershipRepository;

  return new BetterAuthCurrentActorProvider({
    sessions: {
      getSession: () =>
        Promise.resolve({
          user: {
            id: 'user-1',
            email: person.email ?? 'someone@example.org',
            emailVerified: person.emailVerified ?? true,
          },
          session: { createdAt: NOW },
        }),
    },
    memberships,
    getHeaders: () => Promise.resolve(new Headers()),
    sessionMaxLifetimeMs: 1_000_000_000,
    clock: { now: () => NOW },
    platformAdminEmails: new Set(emails),
    getTenantHint: typeof hint === 'function' ? hint : () => Promise.resolve(hint),
  });
}

const actorOf = async (provider: BetterAuthCurrentActorProvider) =>
  (await provider.getCurrentActor())._unsafeUnwrap();

describe('who the actor is, and in which tenant', () => {
  describe('a platform administrator', () => {
    it('is one by a verified address on the deployment list, whatever their memberships', async () => {
      const actor = await actorOf(
        providerFor({ email: 'Boss@Example.org' }, T1, ['boss@example.org']),
      );

      expect(actor.roles).toEqual(['platform_admin']);
      expect(actor.tenantId).toBe(T1);
    });

    it('is one by a membership in the platform scope', async () => {
      const actor = await actorOf(providerFor({ platformMembership: true }, T2));

      expect(actor.roles).toEqual(['platform_admin']);
      expect(actor.tenantId).toBe(T2);
    });

    it('stands in no tenant on a screen that names no website', async () => {
      const actor = await actorOf(providerFor({ platformMembership: true }, null));

      expect(actor.tenantId).toBe(PLATFORM_TENANT_ID);
    });

    it('is not one by an address that is not verified', async () => {
      const actor = await actorOf(
        providerFor({ email: 'boss@example.org', emailVerified: false }, T1, ['boss@example.org']),
      );

      expect(actor.roles).toEqual([]);
    });

    it('is not one by an address that is not on the list', async () => {
      const actor = await actorOf(
        providerFor({ email: 'other@example.org' }, T1, ['boss@example.org']),
      );

      expect(actor.roles).toEqual([]);
    });

    it('takes no tenant from a hint that is not a website id', async () => {
      for (const hint of ['', '../x', 'a b', 'x'.repeat(65), 'a/b']) {
        const actor = await actorOf(providerFor({ platformMembership: true }, hint));
        expect(actor.tenantId).toBe(PLATFORM_TENANT_ID);
      }
    });

    it('is not stopped by a hint that cannot be read', async () => {
      const actor = await actorOf(
        providerFor({ platformMembership: true }, () => Promise.reject(new Error('no request'))),
      );

      expect(actor.tenantId).toBe(PLATFORM_TENANT_ID);
    });
  });

  describe('a member of a tenant', () => {
    it('works in their own tenant, whatever website the request names', async () => {
      const actor = await actorOf(providerFor({ memberships: [['site-1', ['editor']]] }, 'site-2'));

      expect(actor.tenantId).toBe(T1);
      expect(actor.roles).toEqual(['editor']);
    });

    it('works in the tenant the request names when they belong to several', async () => {
      const person = {
        memberships: [
          ['site-1', ['editor']],
          ['site-2', ['viewer']],
        ],
      } satisfies Person;

      expect((await actorOf(providerFor(person, 'site-2'))).roles).toEqual(['viewer']);
      expect((await actorOf(providerFor(person, null))).tenantId).toBe(T1);
    });

    it('holds in each tenant only what that tenant gave them, and never a role from the other', async () => {
      const person = {
        memberships: [
          ['site-1', ['admin']],
          ['site-2', ['viewer']],
        ],
      } satisfies Person;

      const inFirst = await actorOf(providerFor(person, 'site-1'));
      const inSecond = await actorOf(providerFor(person, 'site-2'));
      const nowhere = await actorOf(providerFor(person, 'site-3'));

      expect([inFirst.tenantId, inFirst.roles]).toEqual([T1, ['admin']]);
      expect([inSecond.tenantId, inSecond.roles]).toEqual([T2, ['viewer']]);
      // A tenant they are not in is never taken on the word of the address.
      expect(nowhere.tenantId).toBe(T1);
    });

    it('never holds the platform role from a membership inside a tenant', async () => {
      const actor = await actorOf(
        providerFor({ memberships: [['site-1', ['viewer', 'platform_admin']]] }, 'site-1'),
      );

      expect(actor.roles).toEqual(['viewer']);
    });
  });

  it('holds nothing, anywhere, without a membership', async () => {
    const actor = await actorOf(providerFor({}, 'site-1'));

    expect(actor.tenantId).toBe(UNASSIGNED_TENANT_ID);
    expect(actor.roles).toEqual([]);
  });
});

describe('the development actor', () => {
  const make = (role: Role, hint: string | null) =>
    new DevCurrentActorProvider({
      role,
      getTenantHint: () => Promise.resolve(hint),
      nodeEnv: 'development',
      appUrl: 'http://localhost:3000',
    });

  it('has the configured role, in the website the address names', async () => {
    const actor = (await make('editor', 'site-1').getCurrentActor())._unsafeUnwrap();

    expect(actor.roles).toEqual(['editor']);
    expect(actor.tenantId).toBe(T1);
    expect(actor.id).toBe(toActorId('dev-actor-not-a-real-user'));
  });

  it('stands in no tenant on a screen with no website', async () => {
    const actor = (await make('platform_admin', null).getCurrentActor())._unsafeUnwrap();

    expect(actor.tenantId).toBe(PLATFORM_TENANT_ID);
  });
});
