/**
 * Browser-safe public API: Server Actions and types only, nothing that
 * reaches server-only code. Client Components import from here instead
 * of the main `index.ts`, which reaches server-only infrastructure via
 * `composition.ts`.
 */

export { deleteUnusedDataAction } from './presentation/actions/delete-unused-data-action';
export { deleteUnusedMapAction } from './presentation/actions/delete-unused-map-action';
export { RELEASE_ERROR_CODES } from './domain/errors/release-errors';
export { releaseRoutes } from './presentation/routes';
