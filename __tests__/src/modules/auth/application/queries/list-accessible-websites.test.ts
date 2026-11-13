import { describe, expect, it } from 'vitest';

import { AuthorizeWebsiteAccess } from '@modules/auth/application/queries/authorize-website-access';
import { ListAccessibleWebsites } from '@modules/auth/application/queries/list-accessible-websites';
import { permissionDenied } from '@modules/auth/domain/errors/auth-errors';
import { decide } from '@modules/auth/domain/models/authorize';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { Role } from '@modules/auth/domain/models/role';

import { errAsync, okAsync } from '@lib/result';

describe('ListAccessibleWebsites and AuthorizeWebsiteAccess', () => {
  it('returns isPlatform true and all websites for platform admin', async () => {
    const actor = {
      id: toActorId('admin-1'),
      tenantId: null,
      roles: ['platform_admin' as Role],
    };
    const deps = {
      authorization: {
        requireActor: () => okAsync(actor),
        requireInTenant: (permission: Parameters<typeof decide>[1], tenantId?: string) =>
          decide({ ...actor, tenantId: toTenantId(tenantId ?? 'default') }, permission).isAllowed
            ? okAsync(actor)
            : errAsync(permissionDenied()),
        requireOnResource: () => errAsync(permissionDenied()),
      },
      tenants: {
        listNames: () =>
          okAsync({
            websites: [
              { id: 'site-1', name: 'Site 1' },
              { id: 'site-2', name: 'Site 2' },
            ],
            isTruncated: false,
          }),
      },
      members: {
        findTenantIdsWithRoles: () => okAsync({ tenantIds: [], isTruncated: false }),
      },
    };

    const query = new ListAccessibleWebsites(deps as never);
    const result = await query.execute('audit.read');

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.isPlatform).toBe(true);
    expect(value.websites).toHaveLength(2);
    expect(value.isTruncated).toBe(false);
  });

  it('returns isPlatform false and only authorized websites for website admin', async () => {
    const actor = {
      id: toActorId('mgr-1'),
      tenantId: toTenantId('site-1'),
      roles: ['admin' as Role],
    };
    const deps = {
      authorization: {
        requireActor: () => okAsync(actor),
        requireInTenant: (permission: Parameters<typeof decide>[1], tenantId?: string) =>
          decide({ ...actor, tenantId: toTenantId(tenantId ?? 'default') }, permission).isAllowed
            ? okAsync(actor)
            : errAsync(permissionDenied()),
        requireOnResource: () => errAsync(permissionDenied()),
      },
      tenants: {
        listNames: (ids: readonly string[]) =>
          okAsync({
            websites: ids.map((id) => ({ id, name: `Name of ${id}` })),
            isTruncated: false,
          }),
      },
      members: {
        findTenantIdsWithRoles: () =>
          okAsync({
            tenantIds: ['site-1', 'site-2'],
            isTruncated: false,
          }),
      },
    };

    const query = new ListAccessibleWebsites(deps as never);
    const result = await query.execute('audit.read');

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.isPlatform).toBe(false);
    expect(value.websites).toHaveLength(2);
    expect(value.websites.map((w) => w.id)).toEqual(['site-1', 'site-2']);
  });

  it('authorizes website access when user has permission in tenant', async () => {
    const actor = {
      id: toActorId('user-1'),
      tenantId: toTenantId('site-1'),
      roles: ['admin' as Role],
    };
    const deps = {
      authorization: {
        requireActor: () => okAsync(actor),
        requireInTenant: (_permission: Parameters<typeof decide>[1], tenantId?: string) =>
          tenantId === 'site-1' ? okAsync(actor) : errAsync(permissionDenied()),
      },
      members: {
        findRoles: (_actorId: string, tenantId: string) =>
          tenantId === 'site-1' ? okAsync(['admin']) : okAsync([]),
      },
    };

    const query = new AuthorizeWebsiteAccess(deps as never);
    const allowed = await query.execute('audit.read', 'site-1');
    const denied = await query.execute('audit.read', 'site-forbidden');

    expect(allowed.isOk()).toBe(true);
    expect(denied.isErr()).toBe(true);
    expect(denied._unsafeUnwrapErr().kind).toBe('forbidden');
  });
});
