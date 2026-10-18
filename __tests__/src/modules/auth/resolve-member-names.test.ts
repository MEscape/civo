import { describe, expect, it } from 'vitest';

import { ResolveMemberNames } from '@modules/auth/application/queries/resolve-member-names';
import { permissionDenied } from '@modules/auth/domain/errors/auth-errors';
import { decide } from '@modules/auth/domain/models/authorize';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { Role } from '@modules/auth/domain/models/role';

import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

const TENANT = toTenantId('default');
const ANNA = toActorId('anna');
const BEN = toActorId('ben');
const STRANGER = toActorId('stranger');
const ADMIN = toActorId('admin');

function world(role: Role = 'viewer') {
  const searched: Array<readonly string[]> = [];
  const actor = { id: toActorId('me'), tenantId: TENANT, roles: [role] };

  const deps = {
    authorization: {
      requireInTenant: (permission: Parameters<typeof decide>[1]) =>
        decide(actor, permission).isAllowed ? okAsync(actor) : errAsync(permissionDenied()),
      requireOnResource: () => errAsync(permissionDenied()),
    },
    members: {
      listMembers: () =>
        okAsync({
          members: new Map<typeof ANNA, Role[]>([
            [ANNA, ['admin']],
            [BEN, ['editor']],
          ]),
          isTruncated: false,
        }),
      listPlatformAdmins: () => okAsync([ADMIN]),
    },
    directory: {
      search: (query: { ids: readonly string[]; page: { page: number; pageSize: number } }) => {
        searched.push(query.ids);
        const names: Record<string, string> = {
          anna: 'Anna Müller',
          ben: 'Ben Koch',
          admin: 'Pia Platform',
        };
        const items = query.ids.map((id) => ({
          id: toActorId(id),
          email: `${id}@example.org`,
          name: names[id] ?? id,
          emailVerified: true,
          createdAt: new Date('2026-10-01T00:00:00Z'),
        }));
        return okAsync(toPage(items, items.length, query.page));
      },
    },
  };
  return { deps, searched };
}

const run = (w: ReturnType<typeof world>, ids: readonly string[]) =>
  new ResolveMemberNames(w.deps as never).execute(ids);

describe('resolving the names of members', () => {
  it('names the members asked for, and only their names', async () => {
    const w = world();

    const result = (await run(w, ['anna', 'ben']))._unsafeUnwrap();

    expect(result).toEqual([
      { id: 'anna', name: 'Anna Müller' },
      { id: 'ben', name: 'Ben Koch' },
    ]);
  });

  it('never looks up someone who is not a member of the tenant', async () => {
    const w = world();

    const result = (await run(w, ['anna', STRANGER]))._unsafeUnwrap();

    expect(w.searched).toEqual([['anna']]);
    expect(result.map((entry) => entry.id)).toEqual(['anna']);
  });

  it('names a platform administrator, who acts in every website without being its member', async () => {
    const w = world();

    const result = (await run(w, ['anna', ADMIN]))._unsafeUnwrap();

    expect(result).toEqual([
      { id: 'anna', name: 'Anna Müller' },
      { id: 'admin', name: 'Pia Platform' },
    ]);
  });

  it('asks nothing of the directory when nobody asked for a name or nobody is a member', async () => {
    const w = world();

    expect((await run(w, []))._unsafeUnwrap()).toEqual([]);
    expect((await run(w, [STRANGER]))._unsafeUnwrap()).toEqual([]);
    expect(w.searched).toEqual([]);
  });

  it('is refused to someone who may not read the website', async () => {
    const result = await run(world('employee'), ['anna']);

    expect(result.isErr()).toBe(true);
  });
});
