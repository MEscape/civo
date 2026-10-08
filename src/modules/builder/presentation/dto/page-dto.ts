import type {
  PageConfigView,
  PageSummaryView,
  PageView,
  SavedRevisionView,
} from '../../application/contracts/page-views';

/** The JSON-safe shapes Server Actions and RSC props carry: dates as ISO-8601 strings. */
export interface PageSummaryDto {
  readonly id: string;
  readonly websiteId: string;
  readonly path: string;
  readonly title: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PageDto extends PageSummaryDto {
  readonly config: PageConfigView;
}

/** Only what the editor needs after a save; `websiteId` stays on the server for cache invalidation. */
export interface SavedRevisionDto {
  readonly version: number;
  readonly savedAt: string;
}

export function toPageSummaryDto(view: PageSummaryView): PageSummaryDto {
  return {
    id: view.id,
    websiteId: view.websiteId,
    path: view.path,
    title: view.title,
    version: view.version,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

export function toPageDto(view: PageView): PageDto {
  return { ...toPageSummaryDto(view), config: view.config };
}

export function toSavedRevisionDto(view: SavedRevisionView): SavedRevisionDto {
  return { version: view.version, savedAt: view.savedAt.toISOString() };
}
