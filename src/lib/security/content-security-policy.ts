import { unique } from '@lib/utils';

/** What the policy needs to know about this deployment. */
export interface ContentSecurityPolicyOptions {
  readonly isProduction: boolean;
  /**
   * The object storage URLs the browser itself talks to: the endpoint it uploads to through a
   * presigned address, and where the public bucket is served from (not every deployment has one).
   * Only their origins are used.
   */
  readonly storageUrls: ReadonlyArray<string | undefined>;
  /** The pages draw Mapbox maps, so the browser fetches tiles, styles and fonts from Mapbox. */
  readonly hasMap: boolean;
}

/**
 * Directives that need neither a nonce nor a host list, and so cannot break a script, a style or a
 * request: no plugins, no re-pointing of relative URLs, forms post to this site only, no other
 * site frames this one and this one frames nothing, workers start from this site or from a blob
 * (the map's renderer runs in one) and the manifest is this site's own.
 */
const FIXED_DIRECTIVES = [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "frame-src 'none'",
  "child-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
] as const;

/** What Mapbox GL fetches: styles, sprites and fonts (`api`), vector tiles, and usage events. */
const MAPBOX_CONNECT_ORIGINS = [
  'https://api.mapbox.com',
  'https://*.tiles.mapbox.com',
  'https://events.mapbox.com',
] as const;

/**
 * Images come from this site, from Mapbox's static pictures and tiles, from the storage bucket,
 * and from editor-supplied addresses on any host (a news item's picture), hence `https:`. `data:`
 * and `blob:` are what the map renderer draws its sprites and decoded tiles from.
 */
const IMAGE_SOURCES = ["'self'", 'data:', 'blob:', 'https:'] as const;

/**
 * Development only: Next's hot-reload socket, which not every browser counts as the same site.
 * Production has no such socket, so nothing there may open one.
 */
const DEVELOPMENT_SOCKETS = ['ws:', 'wss:'] as const;

/** The addresses an origin is made of; `null` for a value that is not a URL, so one bad variable cannot take every page down. */
function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * The page policy for one deployment. It has no `script-src` or `default-src`: a script policy
 * needs a per-request nonce, and a nonce forces every page to render per request, which the
 * partial prerendering these pages rely on cannot do.
 *
 * `connect-src` and `img-src` are here because they can be exact. The storage endpoint is only
 * known when the server starts, so the policy is built per process in `proxy.ts` from the
 * validated configuration, never at build time, when a container build has a placeholder.
 * `upgrade-insecure-requests` is production only: a development server on `http://localhost` has
 * no `https:` to rewrite requests to.
 */
export function contentSecurityPolicy(options: ContentSecurityPolicyOptions): string {
  const storageOrigins = options.storageUrls.flatMap((url) =>
    url === undefined ? [] : (originOf(url) ?? []),
  );
  const connectSources = unique([
    "'self'",
    ...storageOrigins,
    ...(options.hasMap ? MAPBOX_CONNECT_ORIGINS : []),
    ...(options.isProduction ? [] : DEVELOPMENT_SOCKETS),
  ]);
  const imageSources = unique([...IMAGE_SOURCES, ...storageOrigins]);

  const directives: string[] = [
    ...FIXED_DIRECTIVES,
    `connect-src ${connectSources.join(' ')}`,
    `img-src ${imageSources.join(' ')}`,
  ];
  if (options.isProduction) {
    directives.push('upgrade-insecure-requests');
  }
  return directives.join('; ');
}
