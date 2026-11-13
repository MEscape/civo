import { describe, expect, it } from 'vitest';

import { ListEmployees } from '@modules/auth/application/queries/list-employees';
import { permissionDenied } from '@modules/auth/domain/errors/auth-errors';
import { decide } from '@modules/auth/domain/models/authorize';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { Role } from '@modules/auth/domain/models/role';

import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

const TENANT = toTenantId('default');

function world(
  role: Role,
  employees: readonly string[] = ['carla', 'anna'],
  websiteId = 'default',
) {
  const asked: Array<{ tenantId: string; role: string | null }> = [];
  const actor = { id: toActorId('me'), tenantId: TENANT, roles: [role] };
  const names: Record<string, string> = { anna: 'Anna Müller', carla: 'Carla Brandt' };
  const deps = {
    authorization: {
      requireActor: () => okAsync(actor),
      requireInTenant: (permission: Parameters<typeof decide>[1]) =>
        decide(actor, permission).isAllowed ? okAsync(actor) : errAsync(permissionDenied()),
      requireOnResource: () => errAsync(permissionDenied()),
    },
    members: {
      findRoles: () => okAsync(actor.roles),
      listMembers: (tenantId: string, filter: { role: string | null }) => {
        asked.push({ tenantId, role: filter.role });
        return okAsync({
          members: new Map(employees.map((id) => [toActorId(id), ['employee']])),
          isTruncated: false,
        });
      },
    },
    directory: {
      search: (query: { ids: readonly string[]; page: { page: number; pageSize: number } }) => {
        const items = [...query.ids]
          .map((id) => ({
            id: toActorId(id),
            email: `${id}@example.org`,
            name: names[id] ?? id,
            emailVerified: true,
            createdAt: new Date('2026-10-01T00:00:00Z'),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return okAsync(toPage(items, items.length, query.page));
      },
    },
  };
  return { run: () => new ListEmployees(deps as never).execute(websiteId), asked };
}

describe('listing the employees of a website for the bookings team', () => {
  it('names the members with the role employee of the named website, by name, never by e-mail', async () => {
    const w = world('editor');

    const result = (await w.run())._unsafeUnwrap();

    expect(w.asked).toEqual([{ tenantId: 'default', role: 'employee' }]);
    expect(result).toEqual({
      employees: [
        { id: 'anna', name: 'Anna Müller' },
        { id: 'carla', name: 'Carla Brandt' },
      ],
      isTruncated: false,
    });
  });

  it('asks for the website named, not for the one that happens to be open', async () => {
    const w = world('admin', ['anna'], 'default');

    await w.run();

    expect(w.asked.map(({ tenantId }) => tenantId)).toEqual(['default']);
  });

  it('is empty when nobody holds the role', async () => {
    expect((await world('admin', []).run())._unsafeUnwrap()).toEqual({
      employees: [],
      isTruncated: false,
    });
  });

  it('is refused to anyone who does not set up the bookings', async () => {
    for (const role of ['viewer', 'contributor', 'employee'] as const) {
      expect((await world(role).run())._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    }
  });
});
