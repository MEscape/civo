import { describe, expect, it } from 'vitest';

import { MAP_VALIDATION_CODES as CODES } from '@modules/map/domain/errors/map-errors';
import {
  GEOMETRY_LIMITS,
  geometryBounds,
  parseGeometry,
  pointFromCoordinates,
} from '@modules/map/domain/geo/geometry';

describe('parseGeometry', () => {
  it.each([
    ['Point', { type: 'Point', coordinates: [10, 51] }],
    [
      'MultiPoint',
      {
        type: 'MultiPoint',
        coordinates: [
          [10, 51],
          [11, 52],
        ],
      },
    ],
    [
      'LineString',
      {
        type: 'LineString',
        coordinates: [
          [10, 51],
          [11, 52],
        ],
      },
    ],
    [
      'MultiLineString',
      {
        type: 'MultiLineString',
        coordinates: [
          [
            [10, 51],
            [11, 52],
          ],
        ],
      },
    ],
    [
      'Polygon',
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    ],
    [
      'MultiPolygon',
      {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        ],
      },
    ],
  ])('accepts a %s', (_name, raw) => {
    expect(parseGeometry(raw).isOk()).toBe(true);
  });

  it.each([
    ['nothing', undefined, CODES.geometryMissing],
    ['null', null, CODES.geometryMissing],
    ['a string', 'POINT(1 2)', CODES.geometryInvalid],
    ['an unknown type', { type: 'Circle', coordinates: [1, 2] }, CODES.geometryUnsupported],
    [
      'a GeometryCollection',
      { type: 'GeometryCollection', geometries: [] },
      CODES.geometryUnsupported,
    ],
    [
      'a point without numbers',
      { type: 'Point', coordinates: ['10', '51'] },
      CODES.geometryInvalid,
    ],
    ['a point with one value', { type: 'Point', coordinates: [10] }, CODES.geometryInvalid],
    [
      'a line with one position',
      { type: 'LineString', coordinates: [[10, 51]] },
      CODES.geometryInvalid,
    ],
    [
      'a polygon ring that is too short',
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
      CODES.geometryInvalid,
    ],
    ['a latitude beyond 90', { type: 'Point', coordinates: [10, 91] }, CODES.coordinatesOutOfRange],
    [
      'a longitude beyond 180',
      { type: 'Point', coordinates: [181, 10] },
      CODES.coordinatesOutOfRange,
    ],
    [
      'NaN coordinates',
      { type: 'Point', coordinates: [Number.NaN, 10] },
      CODES.coordinatesOutOfRange,
    ],
  ])('rejects %s', (_name, raw, issue) => {
    const result = parseGeometry(raw);
    expect(result.isErr() && result.error).toBe(issue);
  });

  it('rejects a geometry with more positions than the limit', () => {
    const coordinates = Array.from({ length: GEOMETRY_LIMITS.maxPositions + 1 }, (_, i) => [
      i % 100,
      10,
    ]);
    const result = parseGeometry({ type: 'LineString', coordinates });
    expect(result.isErr() && result.error).toBe(CODES.geometryTooLarge);
  });
});

describe('pointFromCoordinates', () => {
  it('builds a point in GeoJSON order', () => {
    const result = pointFromCoordinates(51, 10);
    expect(result.isOk() && result.value).toEqual({ type: 'Point', coordinates: [10, 51] });
  });

  it('reports a missing coordinate and an impossible one differently', () => {
    expect(pointFromCoordinates(undefined, 10).isErr()).toBe(true);
    const outOfRange = pointFromCoordinates(95, 10);
    expect(outOfRange.isErr() && outOfRange.error).toBe(CODES.coordinatesOutOfRange);
  });
});

describe('geometryBounds', () => {
  it('covers every vertex of a polygon', () => {
    const geometry = parseGeometry({
      type: 'Polygon',
      coordinates: [
        [
          [1, 2],
          [5, 2],
          [5, 9],
          [1, 2],
        ],
      ],
    });
    expect(geometry.isOk() && geometryBounds(geometry.value)).toEqual([1, 2, 5, 9]);
  });
});
