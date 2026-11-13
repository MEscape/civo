import { describe, expect, it } from 'vitest';

import { boundsForLocations } from '@modules/map/domain/geo/location-bounds';
import { isMapBounds } from '@modules/map/domain/models/saved-map';

describe('boundsForLocations', () => {
  it('gives a single location a nonzero starting area', () => {
    const bounds = boundsForLocations([{ longitude: 10, latitude: 51 }]);

    expect(bounds).toEqual([9.99, 50.99, 10.01, 51.01]);
    expect(isMapBounds(bounds)).toBe(true);
  });

  it('fits every location with room around the outermost points', () => {
    const locations = [
      { longitude: 10, latitude: 51 },
      { longitude: 12, latitude: 53 },
      { longitude: 11, latitude: 52 },
    ];
    const bounds = boundsForLocations(locations);

    expect(bounds).not.toBeNull();
    if (bounds === null) {
      return;
    }
    expect(bounds[0]).toBeLessThan(10);
    expect(bounds[1]).toBeLessThan(51);
    expect(bounds[2]).toBeGreaterThan(12);
    expect(bounds[3]).toBeGreaterThan(53);
    expect(isMapBounds(bounds)).toBe(true);
  });

  it('returns no area for an empty list', () => {
    expect(boundsForLocations([])).toBeNull();
  });

  it('ignores invalid coordinates instead of broadening a valid area', () => {
    const valid = { longitude: 10, latitude: 51 };
    const invalid = [
      { longitude: Number.NaN, latitude: 51 },
      { longitude: 10, latitude: Number.POSITIVE_INFINITY },
      { longitude: Number.NEGATIVE_INFINITY, latitude: 51 },
      { longitude: 181, latitude: 0 },
      { longitude: -181, latitude: 0 },
      { longitude: 0, latitude: 91 },
      { longitude: 0, latitude: -91 },
    ];

    expect(boundsForLocations(invalid)).toBeNull();
    expect(boundsForLocations([...invalid, valid])).toEqual(boundsForLocations([valid]));
  });

  it.each([
    [{ longitude: 180, latitude: 90 }, [179.99, 89.99, 180, 90]],
    [{ longitude: -180, latitude: -90 }, [-180, -90, -179.99, -89.99]],
  ] as const)('keeps the world-edge location %j inside valid bounds', (location, expected) => {
    const bounds = boundsForLocations([location]);

    expect(bounds).toEqual(expected);
    expect(isMapBounds(bounds)).toBe(true);
  });

  it('fits points on opposite sides of the dateline without inverted bounds', () => {
    const bounds = boundsForLocations([
      { longitude: 179.9, latitude: -1 },
      { longitude: -179.9, latitude: 1 },
    ]);

    expect(bounds?.[0]).toBe(-180);
    expect(bounds?.[2]).toBe(180);
    expect(isMapBounds(bounds)).toBe(true);
  });
});
