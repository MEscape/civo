import { describe, expect, it } from 'vitest';

import { actorHasPermission, toTenantId } from '@modules/auth';
import type { Actor, AuthorizationService } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import { PLATFORM_ADMIN_ROLE, ROLES } from '@modules/auth/domain/models/role';
import { PLATFORM_TENANT_ID } from '@modules/auth/domain/models/tenant';
import { CreateWebsite } from '@modules/website/application/commands/create-website';
import { ListWebsites } from '@modules/website/application/queries/list-websites';
import type {
  NewWebsite,
  WebsiteRepository,
} from '@modules/website/domain/ports/website.repository';

import { forbiddenError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

const authorizationFor = (actor: Actor): AuthorizationService => ({
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

describe('listing the websites', () => {
  const run = (actor: Actor) =>
    new ListWebsites({
      authorization: authorizationFor(actor),
      websites: repository().websites,
      audit: audit(),
    }).execute();

  it('is the platform administrator, and shows every tenant', async () => {
    const page = (await run(actorOf(PLATFORM_ADMIN_ROLE)))._unsafeUnwrap();

    expect(page.items.map((website) => website.id)).toEqual(['site-1', 'site-2']);
  });

  it.each(ROLES)('is refused to a %s, however many websites they own', async (role) => {
    const error = (await run(actorOf(role)))._unsafeUnwrapErr();

    expect(error.kind).toBe('forbidden');
  });
});

describe('creating a website', () => {
  const input = { name: 'New town', slug: 'new-town', description: null, templateKey: 'municipal' };

  function create(actor: Actor) {
    const { websites, created } = repository();
    const events = audit();
    const useCase = new CreateWebsite({
      authorization: authorizationFor(actor),
      websites,
      audit: events,
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
});
