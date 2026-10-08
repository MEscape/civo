import { COMPONENT_DEFINITIONS } from './component-definitions';
import { createComponentRegistry } from './component-registry';

/** Built once on first import and immutable afterwards: no start-up registration, no mutable maps. */
export const COMPONENT_REGISTRY = createComponentRegistry(COMPONENT_DEFINITIONS);
