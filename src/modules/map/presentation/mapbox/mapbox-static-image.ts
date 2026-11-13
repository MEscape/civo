import { buildQueryString } from '@lib/utils';

import type { Bounds } from '../../application/contracts/map-constraints';

/**
 * The size asked of Mapbox's Static Images API (retina, so twice this in pixels). The picture sits
 * behind a heavy blur and is cropped to its container, so only its aspect matters, not its size.
 */
const IMAGE_SIZE = { width: 640, height: 400 } as const;
/** The same frame the live map fits its bounds into, so the picture and the map agree. */
const FIT_PADDING = 48;
const STYLE_URL_PATTERN = /^mapbox:\/\/styles\/([\w-]+)\/([\w-]+)$/;
/** The live map's view when it has nothing to fit: the world, a little north of the equator. */
const WORLD_VIEW = '0,20,1';
/** A box this small has no extent to fit; the live map shows a location at this zoom instead. */
const POINT_SPAN_DEGREES = 0.001;
const POINT_ZOOM = 14;
const STATIC_API = 'https://api.mapbox.com/styles/v1';

/** What to frame, and whether it is a box that takes padding (a point or the world view is not). */
function viewOf(bounds: Bounds | null): { readonly frame: string; readonly isBox: boolean } {
  if (bounds === null) {
    return { frame: WORLD_VIEW, isBox: false };
  }
  const [west, south, east, north] = bounds;
  if (east - west < POINT_SPAN_DEGREES && north - south < POINT_SPAN_DEGREES) {
    return {
      frame: `${String((west + east) / 2)},${String((south + north) / 2)},${String(POINT_ZOOM)}`,
      isBox: false,
    };
  }
  return { frame: `[${bounds.join(',')}]`, isBox: true };
}

/**
 * A still picture of what the map is about to show, for the placeholder over it while its first
 * tiles load: the account's own style, framed on the map's starting bounds. `null` when the style
 * is not a `mapbox://` one, so the caller falls back to the plain placeholder.
 *
 * The token is the public one the map itself already sends to the browser. The picture keeps
 * Mapbox's logo and attribution: it is only ever shown blurred, and removing them is not ours to
 * decide.
 */
export function staticMapImageUrl(input: {
  readonly accessToken: string;
  readonly styleUrl: string;
  readonly bounds: Bounds | null;
}): string | null {
  const style = STYLE_URL_PATTERN.exec(input.styleUrl);
  if (style === null) {
    return null;
  }
  const [, owner, id] = style;
  const { frame, isBox } = viewOf(input.bounds);
  const query = buildQueryString({
    access_token: input.accessToken,
    padding: isBox ? FIT_PADDING : undefined,
  });
  const size = `${String(IMAGE_SIZE.width)}x${String(IMAGE_SIZE.height)}@2x`;
  return `${STATIC_API}/${String(owner)}/${String(id)}/static/${frame}/${size}${query}`;
}
