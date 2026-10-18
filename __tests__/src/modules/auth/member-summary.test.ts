import { describe, expect, it } from 'vitest';

import { actorHasPermission, toTenantId } from '@modules/auth';
import type { Actor, AuthorizationService } from '@modules/auth';
import { GetMemberSummary } from '@modules/auth/application/queries/get-member-summary';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { TenantRole } from '@modules/auth/domain/models/role';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const NOW = new Date('2026-10-16T12:00:00Z');

const authorizationFor = (actor: Actor): AuthorizationService => ({
  requireInTenant: (permission) =>
    actorHasPermission(actor, permission)
      ? okAsync(actor)
      : errAsync(forbiddenError('auth.permission_denied', 'Not allowed.')),
  requireOnResource: () => errAsync(forbiddenError('auth.permission_denied', 'Not allowed.')),
});

function run(role: TenantRole) {
  const asked: string[] = [];
  const deps = {
    authorization: authorizationFor({
      id: toActorId('actor-1'),
      tenantId: toTenantId('site-1'),
      roles: [role],
    }),
    members: {
      countMembers: (tenantId: string) => {
        asked.push(tenantId);
        return okAsync({
          members: 3,
          byRole: new Map<TenantRole, number>([
            ['admin', 1],
            ['editor', 2],
            ['employee', 1],
          ]),
        });
      },
    },
    invitations: {
      countOpen: (tenantId: string, now: Date) => {
        asked.push(`${tenantId}@${now.toISOString()}`);
        return okAsync(2);
      },
    },
    clock: { now: () => NOW },
  };
  return { result: new GetMemberSummary(deps as never).execute(), asked };
}

describe('the member summary', () => {
  it('counts the people of the actor’s own tenant, every role listed, and the open invitations', async () => {
    const { result, asked } = run('admin');

    expect((await result)._unsafeUnwrap()).toEqual({
      members: 3,
      byRole: [
        { role: 'admin', count: 1 },
        { role: 'editor', count: 2 },
        { role: 'contributor', count: 0 },
        { role: 'viewer', count: 0 },
        { role: 'employee', count: 1 },
      ],
      openInvitations: 2,
    });
    expect(asked).toEqual(['site-1', `site-1@${NOW.toISOString()}`]);
  });

  it('is refused to someone who may not see the members', async () => {
    const { result, asked } = run('editor');

    expect((await result)._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(asked).toEqual([]);
  });
});
