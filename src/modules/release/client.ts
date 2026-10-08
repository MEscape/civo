/**
 * Browser-safe public API: Server Actions and types only, nothing that
 * reaches server-only code. Client Components import from here instead
 * of the main `index.ts`, which reaches server-only infrastructure via
 * `composition.ts`.
 */

export { toMigrationHistoryDto } from './presentation/dto/migration-history-dto';
export { toReleaseHistoryDto } from './presentation/dto/release-history-dto';

export { releaseRoutes } from './presentation/routes';
