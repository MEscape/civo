/**
 * Domain constants and types that presentation legitimately needs (kind
 * names, record shapes, error codes, enum values). Re-exported here as the
 * application's contract so each is defined exactly once.
 */
export {
  COMPONENT_PLATFORM_ERROR_CODES,
  COMPONENT_PLATFORM_VALIDATION_CODES,
} from '../../domain/errors/component-platform-errors';
export type {
  ComponentPlatformErrorCode,
  ComponentPlatformValidationCode,
} from '../../domain/errors/component-platform-errors';
export { CONTENT_KINDS } from '../../domain/content/content-definitions';
export type { ContentKind, ContentOf } from '../../domain/content/content-definitions';
export { ALERT_SEVERITIES } from '../../domain/content/alert.content';
export { WEEKDAYS } from '../../domain/content/opening-hours-entry.content';
export { WASTE_TYPES } from '../../domain/content/waste-collection-entry.content';
export { GRID_COLUMN_COUNTS, PROP_CONTROLS, PROP_GROUPS } from '../../domain/models/prop-field';
export type { GridColumnCount, PropControl, PropGroup } from '../../domain/models/prop-field';
export { COMPONENT_CATEGORIES } from '../../domain/models/component-definition';
export type { ComponentCategory } from '../../domain/models/component-definition';
export { RENDER_MODES } from '../../domain/models/render-context';
export type { RenderContext, RenderMode } from '../../domain/models/render-context';
export type { RenderableNode } from '../../domain/models/renderable-node';
export { getComponentDefinition } from '../../domain/components/component-definitions';
export type {
  ComponentProps,
  RegisteredComponentName,
} from '../../domain/components/component-definitions';
export type { ContentSourceError } from '../../domain/ports/content-source.port';
export { pickDistribution, pickSeries } from '../../domain/content/pick-smart-city-series';
export type { PickedDistribution, PickedSeries } from '../../domain/content/pick-smart-city-series';
