import type { Page } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { MigrationSummaryView } from './migration-views';
import type { ReleasePreviewView } from './preview-views';
import type { PublicationStatusView } from './publication-views';
import type { HistoryPageOptions } from './release-inputs';
import type { ReleaseHistoryView } from './release-views';

/** The people of a history by actor id, as the module that knows them answers. */
export type MemberNamesResolver = (memberIds: readonly string[]) => AppResultAsync<{
  readonly names: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}>;

/** What the release screens read with; the use cases satisfy it and the composition root adds the names. */
export interface ReleaseReaders {
  readonly listReleases: {
    execute(websiteId: string, options?: HistoryPageOptions): AppResultAsync<ReleaseHistoryView>;
  };
  readonly listMigrations: {
    execute(
      websiteId: string,
      options?: HistoryPageOptions,
    ): AppResultAsync<Page<MigrationSummaryView>>;
  };
  readonly getPublicationStatus: {
    execute(websiteId: string): AppResultAsync<PublicationStatusView>;
  };
  readonly getReleasePreview: {
    execute(websiteId: string, releaseId: string): AppResultAsync<ReleasePreviewView>;
  };
  readonly resolveMemberNames: MemberNamesResolver;
}
