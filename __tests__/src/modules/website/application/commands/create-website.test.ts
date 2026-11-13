import { describe, expect, it } from 'vitest';

import type { Actor, AuthorizationService } from '@modules/auth';
import { actorHasPermission } from '@modules/auth/domain/models/authorize';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { PLATFORM_ADMIN_ROLE, ROLES } from '@modules/auth/domain/models/role';
import { PLATFORM_TENANT_ID } from '@modules/auth/domain/models/tenant';
import { CreateWebsite } from '@modules/website/application/commands/create-website';
import type {
  NewWebsite,
  WebsiteRepository,
} from '@modules/website/domain/ports/website.repository';

import { forbiddenError, infrastructureError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../../support/rate-limiting';

const authorizationFor = (actor: Actor): AuthorizationService => ({
  requireActor: () => okAsync(actor),
  requireInTenant: (permission) =>
    actorHasPermission(actor, permission)
      ? okAsync(actor)
      : errAsync(forbiddenError('auth.permission_denied', 'Not allowed.')),
  requireOnResource: () => errAsync(forbiddenError('auth.permission_denied', 'Not allowed.')),
});

const actorOf = (role: Actor['roles'][number], tenant = 'site-1'): Actor => ({
  id: toActorId(`actor-${role}`),
  tenantId: role === PLATFORM_ADMIN_ROLE ? PLATFORM_TENANT_ID : toTenantId(tenant),
  roles: [role],
});

/** Websites of two tenants, so a listing that is tenant-scoped would show it. */
function repository() {
  const stored = [
    { id: 'site-1', tenantId: 'site-1', name: 'One', slug: 'one' },
    { id: 'site-2', tenantId: 'site-2', name: 'Two', slug: 'two' },
  ];
  const created: unknown[] = [];
  const websites = {
    list: (page: PageRequest) => okAsync(toPage(stored as never, stored.length, page)),
    create: ({ draft, theme }: NewWebsite) => {
      // The real store gives the website one id and uses it as the tenant too.
      const id = `site-${created.length + 3}`;
      const website = {
        ...draft,
        id,
        tenantId: id,
        theme,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
      created.push(website);
      return okAsync(website as never);
    },
    deleteById: () => okAsync(undefined),
  } as unknown as WebsiteRepository;
  return { websites, created };
}

const audit = () => {
  const events: Array<{ type: string; tenantId?: string }> = [];
  return { events, record: (event: { type: string; tenantId?: string }) => events.push(event) };
};

describe('creating a website', () => {
  const input = { name: 'New town', slug: 'new-town', description: null, templateKey: 'municipal' };

  function create(actor: Actor) {
    const { websites, created } = repository();
    const events = audit();
    const useCase = new CreateWebsite({
      authorization: authorizationFor(actor),
      websites,
      audit: events,
      rateLimiter: createTestRateLimiter(),
      homePages: { provision: () => okAsync(undefined) },
    });
    return { run: () => useCase.execute(input), created, events };
  }

  it('is the platform administrator, and the website becomes its own tenant', async () => {
    const { run, created, events } = create(actorOf(PLATFORM_ADMIN_ROLE));

    const view = (await run())._unsafeUnwrap();

    expect(created).toHaveLength(1);
    expect(view.id).toBe('site-3');
    expect(events.events[0]).toMatchObject({ type: 'website.created', tenantId: 'site-3' });
  });

  it.each(ROLES)('is refused to a %s, and nothing is created', async (role) => {
    const { run, created } = create(actorOf(role));

    expect((await run())._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(created).toHaveLength(0);
  });

  it.each([false, true])(
    'preserves provisioning failure when cleanup fails=%s',
    async (cleanupFails) => {
      const { websites } = repository();
      const events = audit();
      const failure = infrastructureError(
        'website.home_page_provisioning_failed',
        'Unavailable',
        null,
      );
      const cleanupFailure = infrastructureError(
        'website.persistence_failed',
        'Cleanup failed',
        null,
      );
      const removed: unknown[] = [];
      websites.deleteById = (id, tenantId) => {
        removed.push({ id, tenantId });
        return cleanupFails ? errAsync(cleanupFailure) : okAsync(undefined);
      };
      const outcome = await new CreateWebsite({
        authorization: authorizationFor(actorOf(PLATFORM_ADMIN_ROLE)),
        websites,
        audit: events,
        rateLimiter: createTestRateLimiter(),
        homePages: { provision: () => errAsync(failure) },
      }).execute(input);
      expect(outcome._unsafeUnwrapErr()).toBe(failure);
      expect(removed).toEqual([{ id: 'site-3', tenantId: 'site-3' }]);
      expect(events.events).toEqual(
        cleanupFails
          ? [
              expect.objectContaining({
                type: 'website.provisioning_rollback_failed',
                errorCode: cleanupFailure.code,
              }),
            ]
          : [],
      );
    },
  );
});
