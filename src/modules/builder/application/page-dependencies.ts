import type { AuthorizationService } from '@modules/auth';

import type { RateLimiter } from '@lib/rate-limit';

import type { ComponentCatalog } from '../domain/models/component-catalog';
import type { BuilderAuditLog } from '../domain/ports/builder-audit-log.port';
import type { DraftPageRenderer } from '../domain/ports/draft-page-renderer.port';
import type { PageRepository } from '../domain/ports/page.repository';

/** What every operation on an existing page needs to authorize and load it. */
export interface PageAccessDependencies {
  readonly authorization: AuthorizationService;
  readonly pages: PageRepository;
}

/**
 * What every protected builder use case is built from. The catalog is a
 * pure model built once from the platform's descriptors by the composition
 * root, so use cases never touch the component registry.
 */
export interface PageDependencies extends PageAccessDependencies {
  readonly components: ComponentCatalog;
  readonly audit: BuilderAuditLog;
}

/** Saving also has a budget per editor: a save is a write of up to a whole page. */
export interface SavePageDependencies extends PageDependencies {
  readonly rateLimiter: RateLimiter;
}

/** The page list reads pages and sketches them from the catalog. */
export type ListPagesDependencies = Pick<
  PageDependencies,
  'authorization' | 'pages' | 'components'
>;

export interface RenderDraftPageDependencies<TOutput> extends PageAccessDependencies {
  readonly rateLimiter: RateLimiter;
  readonly renderer: DraftPageRenderer<TOutput>;
}

/** System callers have no actor, so no authorization service. */
export interface SystemPageDependencies {
  readonly pages: PageRepository;
  readonly components: ComponentCatalog;
  readonly audit: BuilderAuditLog;
}

/** Readers without an actor (the public site, a trusted publisher) only read pages. */
export interface PageReaderDependencies {
  readonly pages: PageRepository;
}
