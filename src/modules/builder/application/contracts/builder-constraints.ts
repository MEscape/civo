/**
 * Domain constants, codes and descriptor types that presentation
 * legitimately needs (form validation, message lookup, editor rules).
 * The component vocabulary (categories, controls, groups) is NOT here: the
 * platform owns it, and presentation reads it from its public client API.
 * Presentation may not import the domain, so they are re-exported here as
 * part of the application's contract. Nothing in this file is defined twice.
 */
export { BUILDER_ERROR_CODES, BUILDER_VALIDATION_CODES } from '../../domain/errors/builder-errors';
export type { BuilderCode } from '../../domain/errors/builder-errors';
export { ID_MAX_LENGTH, NODE_ID_PATTERN } from '../../domain/models/ids';
export type {
  ComponentDescriptor,
  NodeBlueprint,
  PropFieldDescriptor,
  PropItemFieldDescriptor,
  PropOptionDescriptor,
} from '../../domain/models/component-descriptor';
export {
  EDITOR_CAPABILITIES,
  EDITOR_MODES,
  VISIBILITY_PROP_KEY,
} from '../../domain/models/editor-capabilities';
export type { EditorCapability, EditorMode } from '../../domain/models/editor-capabilities';
export {
  HOME_PAGE_PATH,
  INITIAL_PAGE_VERSION,
  PAGE_LIMITS,
  PAGE_PATH_PATTERN,
} from '../../domain/models/page';
export { NODE_TYPE_PATTERN, PAGE_TREE_LIMITS } from '../../domain/models/page-node';
