/**
 * Browser-safe public API: Server Actions, routes and types only, nothing
 * that reaches server-only code. Client Components of OTHER modules import
 * from here instead of the main `index.ts`, which reaches server-only
 * infrastructure via `composition.ts`.
 */

export { builderRoutes } from './presentation/routes';
