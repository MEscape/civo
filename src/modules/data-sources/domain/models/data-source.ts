import type { TenantId } from '@modules/auth';

import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isPlainObject } from '@lib/utils';

import { checkRestConnectionConfig } from '../config/rest-connection-config';
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

/** A validated source that has not been stored yet. */
export interface DataSourceDraft {
  readonly websiteId: WebsiteId;
  readonly name: string;
  readonly kind: DataSourceKind;
  readonly config: Readonly<Record<string, string>>;
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
): Readonly<Record<string, string>> | null {
  switch (kind) {
    case 'REST': {
      const rest = checkRestConnectionConfig(raw, bag);
      if (rest === null) {
        return null;
      }
      return {
        baseUrl: rest.baseUrl,
        path: rest.path,
        authMode: rest.authMode,
      };
    }
    case 'MOCK':
      // The mock provider takes no configuration, and an unexpected key is refused like any other kind's.
      if (isPlainObject(raw) && Object.keys(raw).length === 0) {
        return {};
      }
      bag.add('config', CODES.configInvalid);
      return null;
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
