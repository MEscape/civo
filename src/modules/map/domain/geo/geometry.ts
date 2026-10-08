import { err, ok } from '@lib/result';
import type { Result } from '@lib/result';
import { isPlainObject } from '@lib/utils';

import { MAP_VALIDATION_CODES as CODES } from '../errors/map-errors';

import type { MapValidationCode } from '../errors/map-errors';

/** `[longitude, latitude]`, the GeoJSON order. */
export type Position = readonly [longitude: number, latitude: number];

export type GeoGeometry =
  | { readonly type: 'Point'; readonly coordinates: Position }
  | { readonly type: 'MultiPoint'; readonly coordinates: readonly Position[] }
  | { readonly type: 'LineString'; readonly coordinates: readonly Position[] }
  | {
      readonly type: 'MultiLineString';
      readonly coordinates: ReadonlyArray<readonly Position[]>;
    }
  | {
      readonly type: 'Polygon';
      readonly coordinates: ReadonlyArray<readonly Position[]>;
    }
  | {
      readonly type: 'MultiPolygon';
      readonly coordinates: ReadonlyArray<ReadonlyArray<readonly Position[]>>;
    };

export type GeometryKind = GeoGeometry['type'];

/** `[west, south, east, north]` */
export type Bounds = readonly [number, number, number, number];

/** Why a geometry cannot be drawn: a subset of the map's validation codes. */
export type GeometryIssue = MapValidationCode;

export const GEOMETRY_LIMITS = {
  /** Per feature: one municipality-wide polygon is fine, an unbounded one is not. */
  maxPositions: 10_000,
  minLinePositions: 2,
  minRingPositions: 4,
} as const;

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

const SUPPORTED_TYPES: ReadonlySet<string> = new Set<GeometryKind>([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
]);

export function isValidCoordinate(longitude: number, latitude: number): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    Math.abs(longitude) <= MAX_LONGITUDE &&
    Math.abs(latitude) <= MAX_LATITUDE
  );
}

/** Counts positions while validating, so a huge geometry is rejected without being walked twice. */
class PositionBudget {
  private remaining: number = GEOMETRY_LIMITS.maxPositions;

  take(count: number): boolean {
    this.remaining -= count;
    return this.remaining >= 0;
  }
}

function toPosition(raw: unknown): Result<Position, GeometryIssue> {
  if (!Array.isArray(raw) || raw.length < 2) {
    return err(CODES.geometryInvalid);
  }
  const [longitude, latitude] = raw as unknown[];
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return err(CODES.geometryInvalid);
  }
  return isValidCoordinate(longitude, latitude)
    ? ok([longitude, latitude])
    : err(CODES.coordinatesOutOfRange);
}

function toPositions(
  raw: unknown,
  minimum: number,
  budget: PositionBudget,
): Result<readonly Position[], GeometryIssue> {
  if (!Array.isArray(raw) || raw.length < minimum) {
    return err(CODES.geometryInvalid);
  }
  if (!budget.take(raw.length)) {
    return err(CODES.geometryTooLarge);
  }
  const positions: Position[] = [];
  for (const entry of raw as unknown[]) {
    const position = toPosition(entry);
    if (position.isErr()) {
      return err(position.error);
    }
    positions.push(position.value);
  }
  return ok(positions);
}

function toNested<T>(
  raw: unknown,
  parseItem: (item: unknown) => Result<T, GeometryIssue>,
): Result<readonly T[], GeometryIssue> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return err(CODES.geometryInvalid);
  }
  const items: T[] = [];
  for (const entry of raw as unknown[]) {
    const item = parseItem(entry);
    if (item.isErr()) {
      return err(item.error);
    }
    items.push(item.value);
  }
  return ok(items);
}

function parseCoordinates(
  type: GeometryKind,
  coordinates: unknown,
  budget: PositionBudget,
): Result<GeoGeometry, GeometryIssue> {
  const line = (item: unknown) => toPositions(item, GEOMETRY_LIMITS.minLinePositions, budget);
  const ring = (item: unknown) => toPositions(item, GEOMETRY_LIMITS.minRingPositions, budget);
  const polygon = (item: unknown) => toNested(item, ring);

  switch (type) {
    case 'Point':
      return toPosition(coordinates).map((c) => ({ type, coordinates: c }));
    case 'MultiPoint':
      return toPositions(coordinates, 1, budget).map((c) => ({ type, coordinates: c }));
    case 'LineString':
      return line(coordinates).map((c) => ({ type, coordinates: c }));
    case 'MultiLineString':
      return toNested(coordinates, line).map((c) => ({ type, coordinates: c }));
    case 'Polygon':
      return polygon(coordinates).map((c) => ({ type, coordinates: c }));
    case 'MultiPolygon':
      return toNested(coordinates, polygon).map((c) => ({ type, coordinates: c }));
  }
}

/**
 * Validates untrusted GeoJSON geometry. A feature with an unusable geometry
 * is dropped by the caller, never repaired: a guessed location on a civic
 * map is worse than a missing one. `GeometryCollection` is unsupported on
 * purpose (it hides several shapes behind one record).
 */
export function parseGeometry(raw: unknown): Result<GeoGeometry, GeometryIssue> {
  if (raw === undefined || raw === null) {
    return err(CODES.geometryMissing);
  }
  if (!isPlainObject(raw) || typeof raw['type'] !== 'string') {
    return err(CODES.geometryInvalid);
  }
  const type = raw['type'];
  if (!SUPPORTED_TYPES.has(type)) {
    return err(CODES.geometryUnsupported);
  }
  return parseCoordinates(type as GeometryKind, raw['coordinates'], new PositionBudget());
}

/** A point from separate latitude/longitude columns, the most common shape of tabular open data. */
export function pointFromCoordinates(
  latitude: number | undefined,
  longitude: number | undefined,
): Result<GeoGeometry, GeometryIssue> {
  if (latitude === undefined || longitude === undefined) {
    return err(CODES.geometryMissing);
  }
  return isValidCoordinate(longitude, latitude)
    ? ok({ type: 'Point', coordinates: [longitude, latitude] })
    : err(CODES.coordinatesOutOfRange);
}

function collectPositions(geometry: GeoGeometry): readonly Position[] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
  }
}

export function geometryBounds(geometry: GeoGeometry): Bounds {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [longitude, latitude] of collectPositions(geometry)) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  return [west, south, east, north];
}

export function mergeBounds(first: Bounds | null, second: Bounds): Bounds {
  if (first === null) {
    return second;
  }
  return [
    Math.min(first[0], second[0]),
    Math.min(first[1], second[1]),
    Math.max(first[2], second[2]),
    Math.max(first[3], second[3]),
  ];
}

/** The three families a style distinguishes: multi-geometries draw like their single counterpart. */
export type GeometryFamily = 'point' | 'line' | 'area';

export function geometryFamily(geometry: GeoGeometry): GeometryFamily {
  switch (geometry.type) {
    case 'Point':
    case 'MultiPoint':
      return 'point';
    case 'LineString':
    case 'MultiLineString':
      return 'line';
    case 'Polygon':
    case 'MultiPolygon':
      return 'area';
  }
}
