/**
 * Browser-safe public API: types and constants of the catalog only, nothing
 * that reaches server-only code. Client Components (the builder's
 * properties panel and palette) import from here instead of `index.ts`.
 */
export {
  COMPONENT_CATEGORIES,
  PROP_GROUPS,
} from './application/contracts/component-platform-constraints';

export type { CatalogBoundsView } from './application/contracts/catalog-views';
export type {
  ComponentCategory,
  ContentKind,
  PropControl,
  PropGroup,
} from './application/contracts/component-platform-constraints';
