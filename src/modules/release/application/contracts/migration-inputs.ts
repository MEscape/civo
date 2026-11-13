import type { ConflictResolutionsInput } from '../../domain/migration/conflict-resolution';

export interface ProposeMigrationInput {
  readonly websiteId: string;
}

export interface ApplyMigrationInput {
  readonly websiteId: string;
  readonly migrationId: string;
  readonly resolutions: ConflictResolutionsInput;
}
