/**
 * Domain constants and codes that presentation legitimately needs (form
 * validation, option lists, message lookup). Presentation may not import
 * the domain, so they are re-exported here as part of the application's
 * contract. Nothing in this file is defined twice.
 */
export { WEBSITE_ERROR_CODES, WEBSITE_VALIDATION_CODES } from '../../domain/errors/website-errors';
export type { WebsiteCode } from '../../domain/errors/website-errors';
export { WEBSITE_ID_MAX_LENGTH } from '../../domain/models/ids';
export { SLUG_PATTERN, WEBSITE_LIMITS } from '../../domain/models/website';
export { TEMPLATE_KEYS, type TemplateKey } from '../../domain/models/website-template';
export {
  BODY_FONT_FAMILIES,
  HEX_COLOR_PATTERN,
  THEME_FONT_FAMILIES,
  THEME_RADII,
  THEME_SPACING_SCALES,
} from '../../domain/models/website-theme';
export type {
  BodyFontFamily,
  ThemeFontFamily,
  ThemeRadius,
  ThemeSpacingScale,
} from '../../domain/models/website-theme';
