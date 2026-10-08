import type { ComponentCategory, PropGroup } from '@modules/component-platform/client';

import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import {
  BUILDER_ERROR_CODES as ERRORS,
  BUILDER_VALIDATION_CODES as VALIDATION,
  PAGE_LIMITS,
  PAGE_TREE_LIMITS,
} from '../../application/contracts/builder-constraints';

import type { BuilderCode } from '../../application/contracts/builder-constraints';
import type { Viewport } from '../state/ui-state';

type ValidKeys = NestedKeyOf<MessageCatalog['builder']>;

/** Failures the browser itself detects (a Server Action that never answered). */
export const CLIENT_ERROR_CODES = {
  networkFailed: 'builder.client.network_failed',
} as const;

/**
 * Codes -> translation keys, relative to the `builder` namespace.
 * `satisfies Record<BuilderCode, ...>` makes a new code fail to compile
 * until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.pageNotFound]: fieldPath('errors', 'pageNotFound'),
  [ERRORS.websiteNotFound]: fieldPath('errors', 'websiteNotFound'),
  [ERRORS.nodeNotFound]: fieldPath('errors', 'nodeNotFound'),
  [ERRORS.pagePathTaken]: fieldPath('errors', 'pagePathTaken'),
  [ERRORS.pageVersionConflict]: fieldPath('errors', 'versionConflict'),
  [ERRORS.pageLimitExceeded]: fieldPath('errors', 'pageLimitExceeded'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validationFailed'),
  [ERRORS.placementRejected]: fieldPath('errors', 'placementRejected'),
  [ERRORS.structureChangeNotPermitted]: fieldPath('errors', 'structureNotPermitted'),
  [ERRORS.propChangeNotPermitted]: fieldPath('errors', 'propsNotPermitted'),
  [ERRORS.pageConfigCorrupted]: fieldPath('errors', 'pageCorrupted'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'persistenceFailed'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.idSeedInvalid]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.idSeedReused]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.versionInvalid]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.configInvalid]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.nodeInvalid]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.nodeIdInvalid]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.nodeIdDuplicate]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.nodeTypeInvalid]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.nodePropsInvalid]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.placementInvalid]: fieldPath('validation', 'contentInvalid'),
  [VALIDATION.titleTooShort]: fieldPath('validation', 'titleTooShort'),
  [VALIDATION.titleTooLong]: fieldPath('validation', 'titleTooLong'),
  [VALIDATION.pathInvalid]: fieldPath('validation', 'pathInvalid'),
  [VALIDATION.pathTooLong]: fieldPath('validation', 'pathTooLong'),
  [VALIDATION.configTooLarge]: fieldPath('validation', 'contentTooLarge'),
  [VALIDATION.nodeTypeUnknown]: fieldPath('validation', 'componentUnknown'),
  [VALIDATION.nodeLimitExceeded]: fieldPath('validation', 'nodeLimit'),
  [VALIDATION.depthLimitExceeded]: fieldPath('validation', 'depthLimit'),
  [VALIDATION.nestingNotAllowed]: fieldPath('validation', 'nestingNotAllowed'),
} as const satisfies Record<BuilderCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[BuilderCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isBuilderCode(code: string): code is BuilderCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

export function messageKeyForCode(code: string): MessageKey {
  return isBuilderCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

/** Interpolation values for messages that mention a limit. */
export const MESSAGE_PARAMS = {
  titleMin: PAGE_LIMITS.titleMin,
  titleMax: PAGE_LIMITS.titleMax,
  pathMax: PAGE_LIMITS.pathMax,
  maxNodes: PAGE_TREE_LIMITS.maxNodes,
  maxDepth: PAGE_TREE_LIMITS.maxDepth,
} as const;

export const CATEGORY_MESSAGE_KEYS = {
  layout: fieldPath('palette', 'categories', 'layout'),
  content: fieldPath('palette', 'categories', 'content'),
  civic: fieldPath('palette', 'categories', 'civic'),
  smartcity: fieldPath('palette', 'categories', 'smartcity'),
} as const satisfies Record<ComponentCategory, ValidKeys>;

export const GROUP_MESSAGE_KEYS = {
  data: fieldPath('properties', 'groups', 'data'),
  content: fieldPath('properties', 'groups', 'content'),
  appearance: fieldPath('properties', 'groups', 'appearance'),
} as const satisfies Record<PropGroup, ValidKeys>;

export const VIEWPORT_MESSAGE_KEYS = {
  desktop: fieldPath('toolbar', 'viewport', 'desktop'),
  tablet: fieldPath('toolbar', 'viewport', 'tablet'),
  mobile: fieldPath('toolbar', 'viewport', 'mobile'),
} as const satisfies Record<Viewport, ValidKeys>;
