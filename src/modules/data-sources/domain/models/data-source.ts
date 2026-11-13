import type { TenantId } from '@modules/auth';

import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import type { JsonValue } from '@lib/utils';

import { checkRestConnectionConfig } from '../config/rest-connection-config';
import { mergeRestSettings } from '../config/rest-connection-settings';
import { checkSnapshotSourceConfig } from '../config/snapshot-source-config';
import {
  DATA_SOURCE_VALIDATION_CODES,
  createDataSourceErrorBag,
} from '../errors/data-source-errors';

import { isDataSourceKind } from './data-source-kinds';
import { parseWebsiteId } from './ids';

import type { DataSourceKind, DataSourceStatus } from './data-source-kinds';
import type { WebsiteId, DataSourceId } from './ids';

const CODES = DATA_SOURCE_VALIDATION_CODES;

export const DATA_SOURCE_LIMITS = {
  nameMin: 2,
  nameMax: 100,
} as const;

/**
 * A connection to an external system. A website may have any number of
 * sources of any kind. Datasets (with their field mappings) hang off a
 * source; see `dataset.ts`.
 */
export interface DataSource {
  readonly id: DataSourceId;
  /**
   * Owning tenant, taken from the website the source belongs to. Authorization
   * compares it with the actor's tenant; it must always come from the stored
   * record, never from a request.
   */
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
  readonly name: string;
  readonly kind: DataSourceKind;
  /** The persisted blob. Its connector parses it every time it is used. */
  readonly config: unknown;
  readonly status: DataSourceStatus;
  readonly lastCheckedAt: Date | null;
  /** A stable error code (never prose) from the last failed check. */
  readonly lastErrorCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** The stored form of a validated config: normalized, so every setting that was checked is kept. */
export type DataSourceConfig = Readonly<Record<string, JsonValue>>;

/** A validated source that has not been stored yet. */
export interface DataSourceDraft {
  readonly websiteId: WebsiteId;
  readonly name: string;
  readonly kind: DataSourceKind;
  readonly config: DataSourceConfig;
}

/** A validated edit of a stored source: its name and connection; the kind never changes. */
export interface DataSourceChanges {
  readonly name: string;
  readonly config: DataSourceConfig;
}

export interface DataSourceChangesInput {
  readonly name: string;
  readonly config: unknown;
}

export interface DataSourceDraftInput {
  readonly websiteId: string;
  readonly name: string;
  readonly kind: string;
  readonly config: unknown;
}

function checkName(name: string, bag: FieldErrorBag): void {
  if (name.length < DATA_SOURCE_LIMITS.nameMin) {
    bag.add('name', CODES.nameTooShort);
  } else if (name.length > DATA_SOURCE_LIMITS.nameMax) {
    bag.add('name', CODES.nameTooLong);
  }
}

function checkConfig(
  kind: DataSourceKind,
  raw: unknown,
  bag: FieldErrorBag,
): DataSourceConfig | null {
  switch (kind) {
    case 'REST': {
      const rest = checkRestConnectionConfig(raw, bag);
      // Every checked setting is stored: records path and pagination are part of the connection.
      return rest === null ? null : { ...rest };
    }
    case 'MOCK':
      // Versioned snapshot configuration extends the legacy empty mock configuration.
      return checkSnapshotSourceConfig(raw, bag);
  }
}

/** The only way a new data source enters the system. Reports every invalid field. */
export function createDataSourceDraft(
  input: DataSourceDraftInput,
): AppResult<DataSourceDraft, ValidationAppError> {
  const bag = createDataSourceErrorBag();
  const websiteId = parseWebsiteId(input.websiteId);
  const name = input.name.trim();
  const kind = isDataSourceKind(input.kind) ? input.kind : null;

  if (websiteId.isErr()) {
    bag.add('websiteId', CODES.idInvalid);
  }
  checkName(name, bag);
  if (kind === null) {
    bag.add('kind', CODES.kindUnknown);
  }
  const config = kind === null ? null : checkConfig(kind, input.config, bag);

  if (bag.hasErrors || websiteId.isErr() || kind === null || config === null) {
    return err(bag.toError());
  }
  return ok({ websiteId: websiteId.value, name, kind, config });
}

/**
 * The only way a stored source changes. The submitted connection is laid over the stored one
 * (`mergeRestSettings`) and validated like a new source's, reporting every invalid field.
 */
export function parseDataSourceChanges(
  source: Pick<DataSource, 'kind' | 'config'>,
  input: DataSourceChangesInput,
): AppResult<DataSourceChanges, ValidationAppError> {
  const bag = createDataSourceErrorBag();
  const name = input.name.trim();
  checkName(name, bag);
  const raw =
    source.kind === 'REST' ? mergeRestSettings(source.config, input.config) : input.config;
  const config = checkConfig(source.kind, raw, bag);
  if (bag.hasErrors || config === null) {
    return err(bag.toError());
  }
  return ok({ name, config });
}
