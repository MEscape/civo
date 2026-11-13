import { publicEnv } from './public-env';

/** The tile provider's settings, or `null` when none is configured and a map draws without a base layer. */
export function mapTiles() {
  const accessToken = publicEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  return accessToken === undefined || !publicEnv.NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED
    ? null
    : { accessToken, styleUrl: publicEnv.NEXT_PUBLIC_MAPBOX_STYLE_URL };
}
