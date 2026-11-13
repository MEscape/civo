/**
 * Server-side public API of the media module. Other modules and framework entry points import
 * from here and nowhere deeper. Components that run in the browser import from `./client`
 * instead: this file reaches server-only code through `composition.ts` and must never end up
 * in a client bundle.
 */

/** Server-only helpers for Server Components. Mutations are reachable through Server Actions only. */
export { mediaPublicUrl, mediaUploadsAvailable } from './composition';
export { MediaAdministration } from './presentation/components/library/media-administration';
export { mediaRoutes } from './presentation/routes';

export { default as enMedia } from './presentation/i18n/en.json';
export { default as deMedia } from './presentation/i18n/de.json';
export { MediaOverviewTile } from './presentation/components/library/media-overview-tile';
