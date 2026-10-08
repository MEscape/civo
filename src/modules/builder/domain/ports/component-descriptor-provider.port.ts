import type { ComponentDescriptor } from '../models/component-descriptor';

/**
 * The builder's only view of the component platform. One adapter implements
 * it through the platform's public API; the registry itself never leaks in.
 *
 * Adapter contract:
 *  - Descriptors are plain, JSON-safe data in a stable order.
 *  - `allowedChildTypes` and `isAllowedAtRoot` are computed from the
 *    platform's own nesting rule, so the builder cannot drift from it.
 *  - Every blueprint is valid page content (JSON props, registered types).
 *
 * Synchronous on purpose: the registry is in memory.
 */
export interface ComponentDescriptorProvider {
  listDescriptors(): readonly ComponentDescriptor[];
}
