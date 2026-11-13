import type { AuthorizationService } from '@modules/auth/application/authorization-service';
import { AuthorizeWebsiteAccess } from '@modules/auth/application/queries/authorize-website-access';
import { ListAccessibleWebsites } from '@modules/auth/application/queries/list-accessible-websites';
import { toTenantId } from '@modules/auth/domain/models/ids';
import type { ExistingWebsiteDependencies } from '@modules/website/application/website-dependencies';
import { toWebsiteId } from '@modules/website/domain/models/ids';
import type { Website } from '@modules/website/domain/models/website';
import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import type { WebsiteEvent } from '@modules/website/domain/ports/website-audit-log.port';
import type { WebsiteRepository } from '@modules/website/domain/ports/website.repository';
import { AuthWebsiteAccess } from '@modules/website/infrastructure/access/auth-website-access';

import { infrastructureError } from '@lib/errors';
import { offsetOf, toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../../support/rate-limiting';
import {
  SCOPE_IDS,
  userManagementScopeWorld,
} from '../../../auth/application/support/user-management-scope-world';

export function world(options: { platform?: boolean } = {}) {
  const auth = userManagementScopeWorld(options);
  const authorization: AuthorizationService = auth.deps.authorization;
  const stored = new Map<string, Website>(
    [SCOPE_IDS.a, SCOPE_IDS.b, SCOPE_IDS.c].map((id) => [
      id,
      {
        id: toWebsiteId(id),
        tenantId: toTenantId(id),
        name: `Website ${id}`,
        slug: id,
        description: null,
        templateKey: 'municipal',
        theme: DEFAULT_WEBSITE_THEME,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ]),
  );
  const reads: string[] = [];
  const writes: string[] = [];
  const events: WebsiteEvent[] = [];
  const unavailable = infrastructureError('website.persistence_failed', 'Unavailable', null);
  const websites: WebsiteRepository = {
    findById: (id, tenantId) => {
      reads.push(id);
      const found = stored.get(id);
      return okAsync(found?.tenantId === tenantId ? found : null);
    },
    findBySlug: () => okAsync(null),
    list: (page, websiteIds) => {
      reads.push('list');
      const visible = [...stored.values()].filter(
        (website) => websiteIds === null || websiteIds.includes(website.id),
      );
      return okAsync(
        toPage(visible.slice(offsetOf(page), offsetOf(page) + page.pageSize), visible.length, page),
      );
    },
    create: () => errAsync(unavailable),
    update: (id, tenantId, changes) => {
      const found = stored.get(id);
      if (found?.tenantId !== tenantId) {
        return errAsync(unavailable);
      }
      writes.push(tenantId);
      const updated = { ...found, ...changes };
      stored.set(id, updated);
      return okAsync(updated);
    },
    updateTheme: (id, tenantId, theme) => {
      const found = stored.get(id);
      if (found?.tenantId !== tenantId) {
        return errAsync(unavailable);
      }
      writes.push(tenantId);
      const updated = { ...found, theme };
      stored.set(id, updated);
      return okAsync(updated);
    },
    deleteById: () => okAsync(undefined),
  };
  const deps: ExistingWebsiteDependencies = {
    authorization,
    websites,
    audit: { record: (event) => events.push(event) },
    rateLimiter: createTestRateLimiter(),
    access: new AuthWebsiteAccess(
      () => ({
        authorizeWebsiteAccess: new AuthorizeWebsiteAccess(auth.deps),
        listAccessibleWebsites: new ListAccessibleWebsites(auth.deps),
      }),
      authorization,
    ),
  };
  return { deps, auth, stored, reads, writes, events };
}
