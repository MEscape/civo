import type { TenantId } from '@modules/auth';

import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isDefined, slugify, trimToNull } from '@lib/utils';

import {
  DATA_SOURCE_VALIDATION_CODES,
  createDataSourceErrorBag,
} from '../errors/data-source-errors';

import { isCanonicalKind } from './canonical-kinds';

import type { CanonicalKind } from './canonical-kinds';
import type { DataSource } from './data-source';
import type { DataSourceKind, DataSourceStatus } from './data-source-kinds';
import type { WebsiteId, DataSourceId, DatasetId } from './ids';
import type { DatasetMapping } from '../mapping/dataset-mapping';

const CODES = DATA_SOURCE_VALIDATION_CODES;

export const DATASET_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  slugMax: 50,
} as const;

/** Kept as before (not the stricter website slug) so existing dataset slugs stay valid. */
export const DATASET_SLUG_PATTERN = /^[a-z0-9-]+$/;

/** The parent source, as much of it as a dataset's display needs. */
export interface DatasetSource {
  readonly id: DataSourceId;
  readonly name: string;
  readonly kind: DataSourceKind;
  readonly status: DataSourceStatus;
}

/**
 * The primary handle components use to resolve external data. One canonical
 * type, one field mapping, one parent source.
 */
export interface Dataset {
  readonly id: DatasetId;
  /**
   * Owning tenant, read through the parent source. Authorization compares it
   * with the actor's tenant; it must always come from the stored record,
   * never from a request.
   */
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
  readonly source: DatasetSource;
  readonly name: string;
  readonly slug: string;
  readonly canonicalKind: CanonicalKind;
  /** Null when none was saved, or when the stored one no longer validates. */
  readonly mapping: DatasetMapping | null;
  readonly status: DataSourceStatus;
  readonly lastFetchedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A dataset with its complete parent source, for operations that call the external system. */
export interface DatasetWithSource {
  readonly dataset: Dataset;
  readonly source: DataSource;
}

/** A validated dataset that has not been stored yet. */
export interface DatasetDraft {
  readonly dataSourceId: DataSourceId;
  readonly name: string;
  readonly slug: string;
  readonly canonicalKind: CanonicalKind;
}

export interface DatasetDraftInput {
  readonly name: string;
  /** Derived from the name when omitted or blank. */
  readonly slug?: string | undefined;
  readonly canonicalKind: string;
}

/** `undefined` leaves a field alone. */
export interface DatasetChangesInput {
  readonly name?: string | undefined;
  readonly slug?: string | undefined;
}

export interface DatasetChanges {
  readonly name?: string;
  readonly slug?: string;
}

function checkName(name: string, bag: FieldErrorBag): void {
  if (name.length < DATASET_LIMITS.nameMin) {
    bag.add('name', CODES.datasetNameTooShort);
  } else if (name.length > DATASET_LIMITS.nameMax) {
    bag.add('name', CODES.datasetNameTooLong);
  }
}

function checkSlug(slug: string, bag: FieldErrorBag): void {
  if (slug.length === 0) {
    bag.add('slug', CODES.datasetSlugRequired);
  } else if (slug.length > DATASET_LIMITS.slugMax) {
    bag.add('slug', CODES.datasetSlugTooLong);
  } else if (!DATASET_SLUG_PATTERN.test(slug)) {
    bag.add('slug', CODES.datasetSlugInvalid);
  }
}

/** The only way a new dataset enters the system. Reports every invalid field. */
export function createDatasetDraft(
  dataSourceId: DataSourceId,
  input: DatasetDraftInput,
): AppResult<DatasetDraft, ValidationAppError> {
  const bag = createDataSourceErrorBag();
  const name = input.name.trim();
  const slug = trimToNull(input.slug) ?? slugify(name).slice(0, DATASET_LIMITS.slugMax);
  const canonicalKind = isCanonicalKind(input.canonicalKind) ? input.canonicalKind : null;

  checkName(name, bag);
  checkSlug(slug, bag);
  if (canonicalKind === null) {
    bag.add('canonicalKind', CODES.canonicalKindUnknown);
  }

  if (bag.hasErrors || canonicalKind === null) {
    return err(bag.toError());
  }
  return ok({ dataSourceId, name, slug, canonicalKind });
}

/** Validates a partial update; only the fields that were provided are checked. */
export function parseDatasetChanges(
  input: DatasetChangesInput,
): AppResult<DatasetChanges, ValidationAppError> {
  const bag = createDataSourceErrorBag();
  const changes: { name?: string; slug?: string } = {};

  if (isDefined(input.name)) {
    changes.name = input.name.trim();
    checkName(changes.name, bag);
  }
  if (isDefined(input.slug)) {
    changes.slug = input.slug.trim();
    checkSlug(changes.slug, bag);
  }

  return bag.hasErrors ? err(bag.toError()) : ok(changes);
}

export function isEmptyChanges(changes: DatasetChanges): boolean {
  return Object.keys(changes).length === 0;
}
