import { describe, expect, it } from 'vitest';

import { staticMapImageUrl } from '@modules/map/presentation/mapbox/mapbox-static-image';

const BASE = { accessToken: 'pk.test', styleUrl: 'mapbox://styles/acme/city-light' } as const;

describe('staticMapImageUrl', () => {
  it("frames the map's starting bounds in the account's own style, with the same padding as the live map", () => {
    const url = staticMapImageUrl({ ...BASE, bounds: [9, 50, 11, 52] });

    expect(url).toBe(
      'https://api.mapbox.com/styles/v1/acme/city-light/static/[9,50,11,52]/640x400@2x?access_token=pk.test&padding=48',
    );
  });

  it('shows the world, as the live map does, when there is nothing to frame', () => {
    expect(staticMapImageUrl({ ...BASE, bounds: null })).toBe(
      'https://api.mapbox.com/styles/v1/acme/city-light/static/0,20,1/640x400@2x?access_token=pk.test',
    );
  });

  it('centres on a single location instead of asking for a box with no extent', () => {
    const url = staticMapImageUrl({ ...BASE, bounds: [10, 51, 10, 51] });

    expect(url).toContain('/static/10,51,14/');
    expect(url).not.toContain('padding');
  });

  it('encodes the token', () => {
    const url = staticMapImageUrl({ ...BASE, accessToken: 'pk.a b&c', bounds: null });

    expect(url).toContain('access_token=pk.a+b%26c');
  });

  it.each(['https://example.org/style.json', 'mapbox://styles/acme', 'mapbox://styles/a/b/c'])(
    'gives no picture for a style it cannot name (%s), so the plain placeholder stays',
    (styleUrl) => {
      expect(staticMapImageUrl({ ...BASE, styleUrl, bounds: null })).toBeNull();
    },
  );
});
