import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { UnexpectedAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import {
  arrayOf,
  isInteger,
  isJsonRecord,
  isString,
  literalGuard,
  nullable,
  objectOf,
} from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import { releaseSnapshotCorrupted } from '../../domain/errors/release-errors';
import { toReleaseId, toWebsiteId } from '../../domain/models/ids';
import { RELEASE_SNAPSHOT_SCHEMA_VERSION } from '../../domain/models/release-snapshot';

import type { Release, ReleaseStatus, ReleaseSummary } from '../../domain/models/release';
import type {
  ReleaseComponentDependency,
  ReleaseSnapshot,
} from '../../domain/models/release-snapshot';

/**
 * Persistence shapes. They mirror the columns the module reads and
 * nothing else, so no generated database type ever leaves this layer.
 */

export interface ReleaseSummaryRecord {
  readonly id: string;
  readonly websiteId: string;
  readonly releaseNumber: number;
  readonly status: string;
  readonly publishedAt: InstantRecord | null;
  readonly createdAt: InstantRecord;
}

export interface ReleaseRecord extends ReleaseSummaryRecord {
  readonly snapshot: unknown;
}

interface StoredDependency {
  readonly type: string;
  readonly version: number;
  readonly contracts: Array<{ readonly contract: string; readonly minVersion: number }>;
}

const isStoredDependency = objectOf<StoredDependency>({
  type: isString,
  version: isInteger,
  contracts: arrayOf(
    objectOf<{ readonly contract: string; readonly minVersion: number }>({
      contract: isString,
      minVersion: isInteger,
    }),
  ),
});

/**
 * The flat shape written to the snapshot JSON column. Stored JSON is
 * external data to this build (an older or damaged row), so it is checked,
 * never cast, before any of it reaches the domain.
 */
export interface StoredReleaseSnapshot {
  readonly schemaVersion: typeof RELEASE_SNAPSHOT_SCHEMA_VERSION;
  readonly website: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string | null;
  };
  readonly theme: {
    readonly primaryColor: string;
    readonly secondaryColor: string;
    readonly accentColor: string;
    readonly headingFont: string;
    readonly bodyFont: string;
    readonly radius: string;
    readonly spacingScale: string;
  };
  readonly pages: Array<{
    readonly path: string;
    readonly title: string;
    readonly config: Readonly<Record<string, JsonValue>>;
  }>;
  readonly dependencies: StoredDependency[];
}

const isStoredReleaseSnapshot = objectOf<StoredReleaseSnapshot>({
  schemaVersion: (value): value is typeof RELEASE_SNAPSHOT_SCHEMA_VERSION =>
    value === RELEASE_SNAPSHOT_SCHEMA_VERSION,
  website: objectOf<StoredReleaseSnapshot['website']>({
    id: isString,
    name: isString,
    slug: isString,
    description: nullable(isString),
  }),
  theme: objectOf<StoredReleaseSnapshot['theme']>({
    primaryColor: isString,
    secondaryColor: isString,
    accentColor: isString,
    headingFont: isString,
    bodyFont: isString,
    radius: isString,
    spacingScale: isString,
  }),
  pages: arrayOf(
    objectOf<StoredReleaseSnapshot['pages'][number]>({
      path: isString,
      title: isString,
      config: isJsonRecord,
    }),
  ),
  dependencies: arrayOf(isStoredDependency),
});

const hasStoredDependencies = objectOf<{ readonly dependencies: StoredDependency[] }>({
  dependencies: arrayOf(isStoredDependency),
});

/** Only the dependency records of a stored snapshot; a snapshot without valid ones has none worth reporting. */
export function toStoredDependencies(
  snapshot: unknown,
): readonly ReleaseComponentDependency[] | null {
  return hasStoredDependencies(snapshot) ? snapshot.dependencies : null;
}

/** Select only what the use cases need (persistence.md): history never loads snapshots. */
export const RELEASE_SUMMARY_SELECT = [
  'id',
  'websiteId',
  'releaseNumber',
  'status',
  'publishedAt',
  'createdAt',
] as const satisfies ReadonlyArray<keyof ReleaseSummaryRecord>;

export const RELEASE_SELECT = [
  ...RELEASE_SUMMARY_SELECT,
  'snapshot',
] as const satisfies ReadonlyArray<keyof ReleaseRecord>;

/** The stored enum spelling of each domain status, for writes. */
export const RECORD_STATUS = {
  draft: 'DRAFT',
  published: 'PUBLISHED',
  rolled_back: 'ROLLED_BACK',
  failed: 'FAILED',
} as const satisfies Record<ReleaseStatus, string>;

type RecordStatus = (typeof RECORD_STATUS)[ReleaseStatus];

/** The inverse, for reads. Both tables are checked against each other, so a new status cannot be added to only one. */
const STATUS_BY_RECORD = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ROLLED_BACK: 'rolled_back',
  FAILED: 'failed',
} as const satisfies Record<RecordStatus, ReleaseStatus>;

const isRecordStatus = literalGuard(Object.values(RECORD_STATUS));

/** A status this build does not know reads as `failed`, so it can never be activated. */
function toReleaseStatus(raw: string): ReleaseStatus {
  return isRecordStatus(raw) ? STATUS_BY_RECORD[raw] : 'failed';
}

export function toReleaseSummary(record: ReleaseSummaryRecord): ReleaseSummary {
  return {
    id: toReleaseId(record.id),
    websiteId: toWebsiteId(record.websiteId),
    releaseNumber: record.releaseNumber,
    status: toReleaseStatus(record.status),
    publishedAt: record.publishedAt ? instantToDate(record.publishedAt) : null,
    createdAt: instantToDate(record.createdAt),
  };
}

function toSnapshot(stored: StoredReleaseSnapshot): ReleaseSnapshot {
  return {
    schemaVersion: stored.schemaVersion,
    website: {
      id: toWebsiteId(stored.website.id),
      name: stored.website.name,
      slug: stored.website.slug,
      description: stored.website.description,
    },
    theme: {
      colors: {
        primary: stored.theme.primaryColor,
        secondary: stored.theme.secondaryColor,
        accent: stored.theme.accentColor,
      },
      typography: {
        headingFont: stored.theme.headingFont,
        bodyFont: stored.theme.bodyFont,
      },
      radius: stored.theme.radius,
      spacingScale: stored.theme.spacingScale,
    },
    pages: stored.pages,
    dependencies: stored.dependencies,
  };
}

/** The inverse of `toSnapshot`: the flat shape that is written to the JSON column. */
export function toStoredSnapshot(snapshot: ReleaseSnapshot): StoredReleaseSnapshot {
  return {
    schemaVersion: snapshot.schemaVersion,
    website: { ...snapshot.website },
    theme: {
      primaryColor: snapshot.theme.colors.primary,
      secondaryColor: snapshot.theme.colors.secondary,
      accentColor: snapshot.theme.colors.accent,
      headingFont: snapshot.theme.typography.headingFont,
      bodyFont: snapshot.theme.typography.bodyFont,
      radius: snapshot.theme.radius,
      spacingScale: snapshot.theme.spacingScale,
    },
    pages: snapshot.pages.map((page) => ({ ...page })),
    dependencies: snapshot.dependencies.map((dependency) => ({
      ...dependency,
      contracts: dependency.contracts.map((contract) => ({ ...contract })),
    })),
  };
}

/**
 * Validates the stored snapshot before it reaches the domain. A snapshot
 * that fails is corrupted (or from a schema version this build does not
 * understand) and must never be partially rendered.
 */
export function toRelease(record: ReleaseRecord): AppResult<Release, UnexpectedAppError> {
  const stored: unknown = record.snapshot;
  return isStoredReleaseSnapshot(stored)
    ? ok({ ...toReleaseSummary(record), snapshot: toSnapshot(stored) })
    : err(releaseSnapshotCorrupted(new Error('The stored snapshot has an unexpected shape.')));
}
