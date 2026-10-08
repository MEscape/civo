import { toTenantId } from '@modules/auth';

import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { UnexpectedAppError } from '@lib/errors';
import { ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { toPageId, toWebsiteId } from '../../domain/models/ids';
import { restorePageConfig } from '../../domain/models/page-config';

import type { Page, PageSummary } from '../../domain/models/page';
import type { PageConfig } from '../../domain/models/page-config';
import type { SavedRevision } from '../../domain/models/page-revision';
import type { ReleasePage } from '../../domain/models/release-page';

/**
 * Persistence shapes. They mirror the columns the module reads and
 * nothing else, so no generated database type ever leaves this layer.
 */
export interface PageSummaryRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly websiteId: string;
  readonly path: string;
  readonly title: string;
  readonly version: number;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

export interface PageConfigRecord {
  readonly content: unknown;
}

export interface PageRecord extends PageSummaryRecord {
  /** The latest revision only (see `latestConfigOf`); empty when a page has none. */
  readonly configs: readonly PageConfigRecord[];
}

export interface SavedRevisionRecord {
  readonly version: number;
  readonly updatedAt: InstantRecord;
}

/**
 * Every revision is written as published, as before: publishing a website
 * is a snapshot owned by the release module, so this column carries no
 * draft/live distinction today.
 */
export const PUBLISHED_STATUS = 'PUBLISHED';

/**
 * Field lists for `.select(...)`. `satisfies` keeps each list in sync with
 * its record shape: a typo or a field that is not on the record fails
 * type-checking here, not at runtime (persistence.md: select only what the
 * use case needs).
 */
export const PAGE_SUMMARY_SELECT = [
  'id',
  'tenantId',
  'websiteId',
  'path',
  'title',
  'version',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof PageSummaryRecord>;

export const PAGE_CONFIG_SELECT = ['content'] as const satisfies ReadonlyArray<
  keyof PageConfigRecord
>;

export const SAVED_REVISION_SELECT = ['version', 'updatedAt'] as const satisfies ReadonlyArray<
  keyof SavedRevisionRecord
>;

export function toPageSummary(record: PageSummaryRecord): PageSummary {
  return {
    id: toPageId(record.id),
    tenantId: toTenantId(record.tenantId),
    websiteId: toWebsiteId(record.websiteId),
    path: record.path,
    title: record.title,
    version: record.version,
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  };
}

/**
 * Reads stored JSON through the domain invariants. A page without any
 * stored revision fails closed like any other corrupted page: reads never
 * hand the renderer a broken tree.
 */
export function toPage(record: PageRecord): AppResult<Page, UnexpectedAppError> {
  const [latest] = record.configs;
  return restorePageConfig(latest?.content).map((config) => ({
    ...toPageSummary(record),
    config,
  }));
}

export function toNullablePage(
  record: PageRecord | null,
): AppResult<Page | null, UnexpectedAppError> {
  return record === null ? ok(null) : toPage(record);
}

/**
 * The lenient read for publishers: damage is a state of the page, not a
 * failure of the read.
 */
export function toReleasePage(record: PageRecord): ReleasePage {
  const { path, title, version } = record;
  const pageId = toPageId(record.id);
  const [latest] = record.configs;
  if (latest === undefined) {
    return {
      pageId,
      version,
      path,
      title,
      state: { status: 'config_missing' },
    };
  }
  const restored = restorePageConfig(latest.content);
  return {
    pageId,
    version,
    path,
    title,
    state: restored.isOk()
      ? { status: 'ready', config: restored.value }
      : { status: 'config_invalid' },
  };
}

/** The config was just written from a validated draft, so it is not re-parsed. */
export function toCreatedPage(record: PageSummaryRecord, config: PageConfig): Page {
  return { ...toPageSummary(record), config };
}

export function toSavedRevision(record: SavedRevisionRecord): SavedRevision {
  return { version: record.version, savedAt: instantToDate(record.updatedAt) };
}
