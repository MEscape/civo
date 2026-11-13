import { fieldPath } from '@lib/errors';
import type { FieldErrorBag } from '@lib/errors';
import { hasUnsafePathSegment, isPlainObject } from '@lib/utils';

import { DATA_SOURCE_VALIDATION_CODES as CODES } from '../errors/data-source-errors';

/** The area of a map window: west, south, east, north, in degrees. */
export type AreaBounds = readonly [west: number, south: number, east: number, north: number];

/**
 * How a source's API is asked for the records of one area: the request parameter that carries the
 * condition and a template for its value, with the corners as `{west}`, `{south}`, `{east}` and
 * `{north}`. Every API words it differently (`in_bbox(geo_point_2d, {south}, {west}, {north},
 * {east})`, `within_box(location, ...)`, `{west},{south},{east},{north}`), so it is configured per
 * source; a source without one is asked for everything and the area is applied afterwards.
 */
// Not an interface: the filter is stored inside the source's JSON config, which an interface cannot be assigned to.
export type SpatialFilter = Readonly<{
  /** A query parameter of a GET source, a dot path into the body of a POST source. */
  param: string;
  template: string;
}>;

export const SPATIAL_FILTER_LIMITS = { maxParamLength: 64, maxTemplateLength: 200 } as const;

const PLACEHOLDER = /\{(west|south|east|north)\}/g;
const ANY_BRACE = /[{}]/;
const PARAM_PATTERN = /^[A-Za-z_$][\w$.[\]-]*$/;
// eslint-disable-next-line no-control-regex -- A template is typed text; control characters have no place in a request.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isTemplate(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > SPATIAL_FILTER_LIMITS.maxTemplateLength ||
    CONTROL_CHARACTERS.test(value)
  ) {
    return false;
  }
  // Only the four corners may be written in braces, and at least one must be: otherwise the
  // condition would not depend on the area.
  const rest = value.replace(PLACEHOLDER, '');
  return rest.length < value.length && !ANY_BRACE.test(rest);
}

function isParam(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= SPATIAL_FILTER_LIMITS.maxParamLength &&
    PARAM_PATTERN.test(value) &&
    !hasUnsafePathSegment(value)
  );
}

/**
 * The area filter of a raw config, `null` when there is none. A problem is written to `bag` at
 * `config.spatialFilter.<field>`, and the filter is then `undefined`.
 */
export function checkSpatialFilter(
  raw: unknown,
  bag: FieldErrorBag,
): SpatialFilter | null | undefined {
  if (raw === undefined || raw === null) {
    return null;
  }
  const at = fieldPath('config', 'spatialFilter');
  if (!isPlainObject(raw)) {
    bag.add(at, CODES.spatialFilterInvalid);
    return undefined;
  }
  const { param, template } = raw;
  const hasUnknownKey = Object.keys(raw).some((key) => key !== 'param' && key !== 'template');
  if (hasUnknownKey) {
    bag.add(at, CODES.spatialFilterInvalid);
  }
  if (!isParam(param)) {
    bag.add(fieldPath('config', 'spatialFilter', 'param'), CODES.spatialFilterParamInvalid);
  }
  if (!isTemplate(template)) {
    bag.add(fieldPath('config', 'spatialFilter', 'template'), CODES.spatialFilterTemplateInvalid);
  }
  return hasUnknownKey || !isParam(param) || !isTemplate(template)
    ? undefined
    : { param, template };
}

/** Degrees as the API is told them: six decimals are a tenth of a metre, the trailing zeros are noise. */
const DEGREE_DECIMALS = 6;
const degrees = (value: number) => String(Number(value.toFixed(DEGREE_DECIMALS)));

/** The value of the area parameter for one window. */
export function spatialFilterValue(filter: SpatialFilter, bounds: AreaBounds): string {
  const [west, south, east, north] = bounds;
  const corners = { west, south, east, north };
  return filter.template.replace(PLACEHOLDER, (_match, corner: keyof typeof corners) =>
    degrees(corners[corner]),
  );
}
