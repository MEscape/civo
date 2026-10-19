import { ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { toCatalogEntry } from '../component-platform-view-mappers';

import type { PublicComponentPlatformDependencies } from '../component-platform-dependencies';
import type { ComponentCatalogView } from '../contracts/catalog-views';

/**
 * Every registered component as plain, serializable data. Bounded by the registry, which is code.
 *
 * @authorization public The component catalog is code and contains nothing per tenant.
 * @rate-limit none Reads the component catalog, which is code and the same for everyone; it touches no store.
 */
export class ListComponentCatalog {
  constructor(private readonly deps: PublicComponentPlatformDependencies) {}

  execute(): AppResult<ComponentCatalogView, never> {
    const components = this.deps.registry.list().map(toCatalogEntry);
    return ok({ components });
  }
}
