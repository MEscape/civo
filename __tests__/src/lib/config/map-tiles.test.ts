import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@lib/config/public-env');
});

const withEnv = async (env: Record<string, string | boolean | undefined>) => {
  vi.doMock('@lib/config/public-env', () => ({ publicEnv: env }));
  return (await import('@lib/config/map-tiles')).mapTiles();
};

describe('map tiles', () => {
  it('has none without a token, so a map draws without a base layer', async () => {
    expect(await withEnv({ NEXT_PUBLIC_MAPBOX_STYLE_URL: 'mapbox://styles/a/b' })).toBeNull();
  });

  it('carries the public token and the configured style', async () => {
    expect(
      await withEnv({
        NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED: true,
        NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test',
        NEXT_PUBLIC_MAPBOX_STYLE_URL: 'mapbox://styles/a/b',
      }),
    ).toEqual({ accessToken: 'pk.test', styleUrl: 'mapbox://styles/a/b' });
  });

  it('denies external map requests when a token exists without operator approval', async () => {
    expect(
      await withEnv({
        NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test',
        NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED: false,
      }),
    ).toBeNull();
  });
});
