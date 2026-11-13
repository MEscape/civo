import { actorHasPermission, toTenantId } from '@modules/auth';
import type { Actor, TenantId } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { BuilderDependencies } from '@modules/builder/application/builder-dependencies';
import { CreatePage } from '@modules/builder/application/commands/create-page';
import { SavePageConfig } from '@modules/builder/application/commands/save-page-config';
import { GetEditorSession } from '@modules/builder/application/queries/get-editor-session';
import { ListDatasetUsage } from '@modules/builder/application/queries/list-dataset-usage';
import { ListMapUsage } from '@modules/builder/application/queries/list-map-usage';
import { ListPages } from '@modules/builder/application/queries/list-pages';
import { RenderDraftPage } from '@modules/builder/application/queries/render-draft-page';
import { ResolvePageTitles } from '@modules/builder/application/queries/resolve-page-titles';
import { createComponentCatalog } from '@modules/builder/domain/models/component-catalog';
import { toPageId, toWebsiteId } from '@modules/builder/domain/models/ids';
import type { Page } from '@modules/builder/domain/models/page';
import { EMPTY_PAGE_CONFIG } from '@modules/builder/domain/models/page-config';
import type { PageNode } from '@modules/builder/domain/models/page-node';
import type { BuilderAccess } from '@modules/builder/domain/ports/builder-access.port';
import type { BuilderEvent } from '@modules/builder/domain/ports/builder-audit-log.port';
import type { PageRepository } from '@modules/builder/domain/ports/page.repository';

import { conflictError, forbiddenError } from '@lib/errors';
import { offsetOf, toPage } from '@lib/pagination';
import type { RateLimiter } from '@lib/rate-limit';
import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../support/rate-limiting';

export const SITE = '11111111-1111-4111-8111-111111111111';
export const OTHER_SITE = '22222222-2222-4222-8222-222222222222';

export function actorWithRole(tenantId: string, role: Actor['roles'][number]): Actor {
  return { id: toActorId(`actor-${role}`), tenantId: toTenantId(tenantId), roles: [role] };
}

/**
 * Website access for one actor, deciding like auth does: the actor must hold the permission in
 * the named website, whichever website the session has open.
 */
export function accessFor(actor: Actor | null): BuilderAccess {
  const allowed = (
    permission: Parameters<BuilderAccess['authorizeWebsite']>[0],
    website: unknown,
  ) => actor !== null && actor.tenantId === website && actorHasPermission(actor, permission);
  return {
    authorizeWebsite: (permission, website) =>
      actor !== null && allowed(permission, website)
        ? okAsync({ actorId: actor.id, tenantId: actor.tenantId })
        : errAsync(forbiddenError('auth.permission_denied', 'Not allowed.')),
    mayInWebsite: (permission, website) => okAsync(allowed(permission, website)),
  };
}

export const node = (id: string): PageNode =>
  ({ id, type: 'text', props: {}, children: [] }) as never;

/** Pages of every website in one map, matched on (id, tenant) exactly like the real table. */
export class InMemoryPageRepository implements PageRepository {
  readonly rows = new Map<string, Page>();
  readonly saved: string[] = [];

  add(overrides: Partial<Omit<Page, 'id'>> & { id: string }): Page {
    const tenantId = overrides.tenantId ?? toTenantId(SITE);
    const page: Page = {
      tenantId,
      websiteId: toWebsiteId(tenantId),
      path: overrides.id,
      title: `Page ${overrides.id}`,
      version: 1,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      config: EMPTY_PAGE_CONFIG,
      ...overrides,
      id: toPageId(overrides.id),
    };
    this.rows.set(overrides.id, page);
    return page;
  }

  private owned(id: string, tenantId: TenantId): Page | null {
    const row = this.rows.get(id);
    return row?.tenantId === tenantId ? row : null;
  }

  findById(id: string, tenantId: TenantId) {
    return okAsync(this.owned(id, tenantId));
  }
  findSummaryById(id: string, tenantId: TenantId) {
    return okAsync(this.owned(id, tenantId));
  }
  findTitles(_website: string, tenantId: TenantId, ids: readonly string[]) {
    return okAsync(
      ids.flatMap((id) => {
        const row = this.owned(id, tenantId);
        return row === null ? [] : [{ id: row.id, title: row.title }];
      }),
    );
  }
  listByWebsite(
    _website: string,
    tenantId: TenantId,
    page: Parameters<PageRepository['listByWebsite']>[2],
  ) {
    const all = [...this.rows.values()].filter((row) => row.tenantId === tenantId);
    const start = offsetOf(page);
    return okAsync(toPage(all.slice(start, start + page.pageSize), all.length, page));
  }
  listReleasePages() {
    return okAsync([]);
  }
  create({ tenantId, draft }: Parameters<PageRepository['create']>[0]) {
    return okAsync(
      this.add({ id: `new-${this.rows.size}`, tenantId, path: draft.path, title: draft.title }),
    );
  }
  saveConfig({
    id,
    tenantId,
    config,
    expectedVersion,
  }: Parameters<PageRepository['saveConfig']>[0]) {
    const row = this.owned(id, tenantId);
    if (row?.version !== expectedVersion) {
      return errAsync(conflictError('builder.page_version_conflict', 'Stale.'));
    }
    this.saved.push(id);
    this.rows.set(id, { ...row, config, version: row.version + 1 });
    return okAsync({ version: row.version + 1, savedAt: new Date(0) });
  }
}

export function builderWorld(
  actor: Actor | null,
  parts: {
    pages?: InMemoryPageRepository;
    rateLimiter?: RateLimiter;
    components?: BuilderDependencies['components'];
  } = {},
) {
  const pages = parts.pages ?? new InMemoryPageRepository();
  const events: BuilderEvent[] = [];
  const rendered: Array<{ websiteId: string; isPreview?: true }> = [];
  const rateLimiter = parts.rateLimiter ?? createTestRateLimiter();
  const deps: BuilderDependencies = {
    access: accessFor(actor),
    pages,
    components: parts.components ?? createComponentCatalog([]),
    audit: { record: (event) => events.push(event) },
  };
  return {
    websiteId: actor?.tenantId ?? SITE,
    pages,
    events,
    rendered,
    createPage: new CreatePage(deps),
    savePageConfig: new SavePageConfig({ ...deps, rateLimiter }),
    getEditorSession: new GetEditorSession(deps),
    listPages: new ListPages(deps),
    listDatasetUsage: new ListDatasetUsage(deps),
    listMapUsage: new ListMapUsage(deps),
    resolvePageTitles: new ResolvePageTitles(deps),
    renderDraftPage: new RenderDraftPage<string>({
      access: deps.access,
      rateLimiter,
      pages,
      renderer: {
        render: ({ websiteId, isPreview }) => {
          rendered.push(isPreview === true ? { websiteId, isPreview } : { websiteId });
          return 'rendered';
        },
      },
    }),
  };
}
