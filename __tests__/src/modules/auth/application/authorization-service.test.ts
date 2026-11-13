import { describe, expect, it } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import { unauthenticated } from '@modules/auth/domain/errors/auth-errors';
import type { Actor } from '@modules/auth/domain/models/actor';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { SecurityEvent } from '@modules/auth/domain/ports/security-audit-log.port';

import { errAsync, okAsync } from '@lib/result';

function world(actor: Actor) {
  const events: SecurityEvent[] = [];
  const currentActor = { getCurrentActor: () => okAsync(actor) };
  const service = createAuthorizationService({
    currentActor,
    audit: { record: (event) => events.push(event) },
  });
  return { service, events };
}
const actor: Actor = { id: toActorId('reader'), tenantId: toTenantId('site-1'), roles: ['viewer'] };

describe('authorization service', () => {
  it('authenticates without inventing a permission decision', async () => {
    const { service, events } = world(actor);
    expect((await service.requireActor())._unsafeUnwrap()).toBe(actor);
    expect(events).toEqual([]);
  });

  it('permits held permissions in the actor tenant and refuses foreign stored resources', async () => {
    const { service, events } = world(actor);
    expect((await service.requireInTenant('website.read'))._unsafeUnwrap()).toBe(actor);
    expect(
      (await service.requireOnResource('website.read', { tenantId: actor.tenantId })).isOk(),
    ).toBe(true);
    expect(
      (
        await service.requireOnResource('website.read', { tenantId: toTenantId('foreign') })
      )._unsafeUnwrapErr().kind,
    ).toBe('forbidden');
    expect(events).toEqual([
      expect.objectContaining({
        type: 'authorization.denied',
        actorId: actor.id,
        permission: 'website.read',
      }),
    ]);
  });

  it('audits denied permissions without exposing internal denial reasons to callers', async () => {
    const { service, events } = world(actor);
    const error = (await service.requireInTenant('website.update'))._unsafeUnwrapErr();
    expect(error).toMatchObject({ code: 'auth.permission_denied', kind: 'forbidden' });
    expect(error).not.toHaveProperty('reason');
    expect(events).toHaveLength(1);
  });

  it('preserves authentication errors and does not record a permission denial for an anonymous caller', async () => {
    const error = unauthenticated();
    const events: SecurityEvent[] = [];
    const service = createAuthorizationService({
      currentActor: { getCurrentActor: () => errAsync(error) },
      audit: { record: (event) => events.push(event) },
    });
    expect((await service.requireInTenant('website.read'))._unsafeUnwrapErr()).toBe(error);
    expect(events).toEqual([]);
  });
});
