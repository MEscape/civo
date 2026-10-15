import { describe, expect, it } from 'vitest';

import { actorHasPermission, toTenantId } from '@modules/auth';
import type { Actor, AuthorizationService } from '@modules/auth';
import { GrantPlatformAdmin } from '@modules/auth/application/commands/grant-platform-admin';
import { RevokePlatformAdmin } from '@modules/auth/application/commands/revoke-platform-admin';
import { ListPlatformAdmins } from '@modules/auth/application/queries/list-platform-admins';
import { toActorId } from '@modules/auth/domain/models/ids';
import { PLATFORM_ADMIN_ROLE, ROLES } from '@modules/auth/domain/models/role';
import { PLATFORM_TENANT_ID } from '@modules/auth/domain/models/tenant';

import { forbiddenError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

const denied = () => errAsync(forbiddenError('auth.permission_denied', 'Not allowed.'));
const authorizationFor = (actor: Actor): AuthorizationService => ({
  requireInTenant: (permission) =>
    actorHasPermission(actor, permission) ? okAsync(actor) : denied(),
  requireOnResource: denied,
});
const actorOf = (role: Actor['roles'][number]): Actor => ({
  id: toActorId(`actor-${role}`),
  tenantId: role === PLATFORM_ADMIN_ROLE ? PLATFORM_TENANT_ID : toTenantId('site-1'),
  roles: [role],
});

const ANNA = {
  id: toActorId('anna'),
  email: 'anna@example.org',
  name: 'Anna',
  emailVerified: true,
  createdAt: new Date(0),
};
const UNVERIFIED = {
  ...ANNA,
  id: toActorId('ben'),
  email: 'ben@example.org',
  emailVerified: false,
};

function world(actor: Actor) {
  const admins = new Set<string>(['actor-platform_admin']);
  const events: Array<{ type: string; subjectId: unknown }> = [];
  const deps = {
    authorization: authorizationFor(actor),
    members: {
      listPlatformAdmins: () => okAsync([...admins].map(toActorId)),
      setPlatformAdmin: (id: string, on: boolean) => {
        if (on) {
          admins.add(id);
        } else {
          admins.delete(id);
        }
        return okAsync(undefined);
      },
    },
    directory: {
      findByEmail: (email: string) =>
        okAsync([ANNA, UNVERIFIED].find((user) => user.email === email) ?? null),
      search: ({ ids, page }: { ids: readonly string[]; page: never }) =>
        okAsync(
          toPage(
            [ANNA].filter((user) => ids.includes(user.id)),
            1,
            page,
          ),
        ),
    },
    audit: { record: (event: { type: string; subjectId: unknown }) => events.push(event) },
  } as never;
  return { deps, admins, events };
}

describe('platform administration', () => {
  it.each(ROLES)('is refused to a %s, and changes nothing', async (role) => {
    const { deps, admins } = world(actorOf(role));

    const results = await Promise.all([
      new GrantPlatformAdmin(deps).execute('anna@example.org'),
      new RevokePlatformAdmin(deps).execute('actor-platform_admin'),
      new ListPlatformAdmins(deps).execute(),
    ]);

    for (const result of results) {
      expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    }
    expect([...admins]).toEqual(['actor-platform_admin']);
  });

  it('is done by a platform administrator: grant is audited, and the person is listed', async () => {
    const { deps, admins, events } = world(actorOf(PLATFORM_ADMIN_ROLE));

    (await new GrantPlatformAdmin(deps).execute(' Anna@Example.org '))._unsafeUnwrap();

    expect(admins.has('anna')).toBe(true);
    expect(events).toEqual([
      { type: 'platform_admin.granted', actorId: 'actor-platform_admin', subjectId: 'anna' },
    ]);
    expect(
      (await new ListPlatformAdmins(deps).execute())._unsafeUnwrap().map((a) => a.email),
    ).toEqual(['anna@example.org']);
  });

  it('answers "not found" for an unknown or unverified address, and grants nothing', async () => {
    const { deps, admins } = world(actorOf(PLATFORM_ADMIN_ROLE));

    for (const email of ['nobody@example.org', 'ben@example.org']) {
      expect((await new GrantPlatformAdmin(deps).execute(email))._unsafeUnwrapErr().kind).toBe(
        'not_found',
      );
    }
    expect([...admins]).toEqual(['actor-platform_admin']);
  });

  it('revokes someone else, audited, and never oneself', async () => {
    const { deps, admins, events } = world(actorOf(PLATFORM_ADMIN_ROLE));
    await new GrantPlatformAdmin(deps).execute('anna@example.org');

    (await new RevokePlatformAdmin(deps).execute('anna'))._unsafeUnwrap();
    const self = await new RevokePlatformAdmin(deps).execute('actor-platform_admin');

    expect(admins.has('anna')).toBe(false);
    expect(events.map((e) => e.type)).toEqual(['platform_admin.granted', 'platform_admin.revoked']);
    expect(self._unsafeUnwrapErr().kind).toBe('conflict');
    expect(admins.has('actor-platform_admin')).toBe(true);
  });
});
