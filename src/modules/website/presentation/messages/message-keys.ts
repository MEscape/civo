import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import {
  WEBSITE_ERROR_CODES as ERRORS,
  WEBSITE_LIMITS,
  WEBSITE_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/website-constraints';

import type {
  TemplateKey,
  ThemeRadius,
  ThemeSpacingScale,
  WebsiteCode,
} from '../../application/contracts/website-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['website']>;

/**
 * Codes -> translation keys, relative to the `website` namespace.
 * `satisfies Record<WebsiteCode, ...>` makes a new code fail to compile
 * until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.notFound]: fieldPath('errors', 'notFound'),
  [ERRORS.slugTaken]: fieldPath('errors', 'slugTaken'),
  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.homePageProvisioningFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.homePageBlueprintRejected]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
  [VALIDATION.nameTooShort]: fieldPath('validation', 'nameTooShort'),
  [VALIDATION.nameTooLong]: fieldPath('validation', 'nameTooLong'),
  [VALIDATION.slugRequired]: fieldPath('validation', 'slugRequired'),
  [VALIDATION.slugTooLong]: fieldPath('validation', 'slugTooLong'),
  [VALIDATION.slugInvalid]: fieldPath('validation', 'slugInvalid'),
  [VALIDATION.descriptionTooLong]: fieldPath('validation', 'descriptionTooLong'),
  [VALIDATION.templateUnknown]: fieldPath('validation', 'templateUnknown'),
  [VALIDATION.colorInvalid]: fieldPath('validation', 'colorInvalid'),
  [VALIDATION.fontUnsupported]: fieldPath('validation', 'fontUnsupported'),
  [VALIDATION.radiusUnsupported]: fieldPath('validation', 'radiusUnsupported'),
  [VALIDATION.spacingUnsupported]: fieldPath('validation', 'spacingUnsupported'),
} as const satisfies Record<WebsiteCode, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[WebsiteCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isWebsiteCode(code: string): code is WebsiteCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/**
 * Codes from other modules (authorization, for instance) or from Zod's own
 * structural messages are unknown here and get the generic message.
 */
export function messageKeyForCode(code: string): MessageKey {
  return isWebsiteCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

/** Interpolation values for messages that mention a limit. */
export const MESSAGE_PARAMS = {
  nameMin: WEBSITE_LIMITS.nameMin,
  nameMax: WEBSITE_LIMITS.nameMax,
  slugMax: WEBSITE_LIMITS.slugMax,
  descriptionMax: WEBSITE_LIMITS.descriptionMax,
} as const;

export const TEMPLATE_MESSAGE_KEYS = {
  municipal: {
    label: fieldPath('templates', 'municipal', 'label'),
    description: fieldPath('templates', 'municipal', 'description'),
  },
  'smart-city': {
    label: fieldPath('templates', 'smartCity', 'label'),
    description: fieldPath('templates', 'smartCity', 'description'),
  },
  association: {
    label: fieldPath('templates', 'association', 'label'),
    description: fieldPath('templates', 'association', 'description'),
  },
} as const satisfies Record<TemplateKey, { label: ValidKeys; description: ValidKeys }>;

export const RADIUS_MESSAGE_KEYS = {
  none: fieldPath('themeSettings', 'radius', 'none'),
  sm: fieldPath('themeSettings', 'radius', 'sm'),
  md: fieldPath('themeSettings', 'radius', 'md'),
  lg: fieldPath('themeSettings', 'radius', 'lg'),
} as const satisfies Record<ThemeRadius, ValidKeys>;

export const SPACING_MESSAGE_KEYS = {
  compact: fieldPath('themeSettings', 'spacing', 'compact'),
  comfortable: fieldPath('themeSettings', 'spacing', 'comfortable'),
  spacious: fieldPath('themeSettings', 'spacing', 'spacious'),
} as const satisfies Record<ThemeSpacingScale, ValidKeys>;
