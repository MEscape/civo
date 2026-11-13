import { describe, expect, it } from 'vitest';

import type { AuthorizationService } from '@modules/auth/application/authorization-service';
import { GrantPlatformAdmin } from '@modules/auth/application/commands/grant-platform-admin';
import { RevokePlatformAdmin } from '@modules/auth/application/commands/revoke-platform-admin';
import type { Actor } from '@modules/auth/domain/models/actor';
import { actorHasPermission } from '@modules/auth/domain/models/authorize';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { PLATFORM_ADMIN_ROLE, ROLES } from '@modules/auth/domain/models/role';
import { PLATFORM_TENANT_ID } from '@modules/auth/domain/models/tenant';

import { forbiddenError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

const denied = () => errAsync(forbiddenError('auth.permission_denied', 'Not allowed.'));
const authorizationFor = (actor: Actor): AuthorizationService => ({
  requireActor: () => okAsync(actor),
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

const ROOT_ADMIN = {
  ...ANNA,
  id: toActorId('actor-platform_admin'),
  email: 'root@example.org',
  name: 'Root',
};

function world(actor: Actor) {
  const admins = new Set<string>(['actor-platform_admin']);
  const accounts = [ANNA, UNVERIFIED, ROOT_ADMIN];
  const events: Array<{ type: string; subjectId: unknown }> = [];
  const deps = {
    authorization: authorizationFor(actor),
    members: {
      isPlatformAdmin: (id: string) => okAsync(admins.has(id)),
      listPlatformAdmins: () => okAsync({ ids: [...admins].map(toActorId), isTruncated: false }),
      grantPlatformAdmin: (id: string) => {
        admins.add(id);
        return okAsync(true);
      },
      revokePlatformAdmin: (
        id: string,
        requestingActor: { actorId: string; authority: 'bootstrap' | 'membership' },
      ) => {
        if (requestingActor.authority === 'membership' && !admins.has(requestingActor.actorId)) {
          return okAsync(false);
        }
        admins.delete(id);
        return okAsync(true);
      },
    },
    directory: {
      findByEmail: (email: string) =>
        okAsync(accounts.find((user) => user.email === email) ?? null),
      search: ({ ids, page }: { ids?: readonly string[]; page?: unknown }) =>
        okAsync(
          toPage(
            accounts.filter((user) => ids === undefined || ids.includes(user.id)),
            1,
            (page as { page: number; pageSize: number }) ?? { page: 1, pageSize: 10 },
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
      new GrantPlatformAdmin(deps).execute('anna'),
      new RevokePlatformAdmin(deps).execute('actor-platform_admin'),
    ]);

    for (const result of results) {
      expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    }
    expect([...admins]).toEqual(['actor-platform_admin']);
  });

  it('is done by a platform administrator: grant is audited', async () => {
    const { deps, admins, events } = world(actorOf(PLATFORM_ADMIN_ROLE));

    (await new GrantPlatformAdmin(deps).execute('anna'))._unsafeUnwrap();

    expect(admins.has('anna')).toBe(true);
    expect(events).toEqual([
      { type: 'platform_admin.granted', actorId: 'actor-platform_admin', subjectId: 'anna' },
    ]);
  });

  it('answers "not found" for an unknown or unverified account, and grants nothing', async () => {
    const { deps, admins } = world(actorOf(PLATFORM_ADMIN_ROLE));

    for (const id of ['nobody', 'ben']) {
      expect((await new GrantPlatformAdmin(deps).execute(id))._unsafeUnwrapErr().kind).toBe(
        'not_found',
      );
    }
    expect([...admins]).toEqual(['actor-platform_admin']);
  });

  it('revokes someone else, audited, and never oneself', async () => {
    const { deps, admins, events } = world(actorOf(PLATFORM_ADMIN_ROLE));
    await new GrantPlatformAdmin(deps).execute('anna');

    (await new RevokePlatformAdmin(deps).execute('anna'))._unsafeUnwrap();
    const self = await new RevokePlatformAdmin(deps).execute('actor-platform_admin');

    expect(admins.has('anna')).toBe(false);
    expect(events.map((e) => e.type)).toEqual(['platform_admin.granted', 'platform_admin.revoked']);
    expect(self._unsafeUnwrapErr().kind).toBe('conflict');
    expect(admins.has('actor-platform_admin')).toBe(true);
  });

  it('records no event when the revoked account held no platform membership', async () => {
    const { deps, events } = world(actorOf(PLATFORM_ADMIN_ROLE));

    (await new RevokePlatformAdmin(deps).execute('anna'))._unsafeUnwrap();

    expect(events).toEqual([]);
  });

  it('refuses a queued revocation after the acting administrator loses membership', async () => {
    const actor = actorOf(PLATFORM_ADMIN_ROLE);
    const { deps, admins, events } = world(actor);
    admins.add('anna');
    admins.delete(actor.id);
    const result = await new RevokePlatformAdmin(deps).execute('anna');
    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(admins.has('anna')).toBe(true);
    expect(events).toEqual([]);
  });

  it('allows explicitly trusted bootstrap authority to revoke the last membership administrator', async () => {
    const actor: Actor = {
      ...actorOf(PLATFORM_ADMIN_ROLE),
      id: toActorId('configured-bootstrap'),
      platformAuthority: 'bootstrap',
    };
    const { deps, admins } = world(actor);
    const result = await new RevokePlatformAdmin(deps).execute('actor-platform_admin');
    expect(result.isOk()).toBe(true);
    expect(admins.size).toBe(0);
  });
});
