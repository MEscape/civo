import type { SerializedActionError } from '@lib/result';

import { REST_SOURCE_FORM_DEFAULTS } from './rest-source-form-schema';

import type { RestSourceForm } from './rest-source-form-schema';
import type {
  DataSourceSettingsView,
  RestConnectionSettingsView,
} from '../../application/contracts/data-source-views';

const nonEmpty = (text: string): string | undefined => (text === '' ? undefined : text);

/** The page size as typed; text that is no number is passed on as is, for the server to refuse. */
function pageSizeOf(text: string): number | string | undefined {
  if (text === '') {
    return undefined;
  }
  const size = Number(text);
  return Number.isNaN(size) ? text : size;
}

function paginationOf(values: RestSourceForm): Record<string, unknown> | undefined {
  const pageSize = pageSizeOf(values.pageSize);
  switch (values.paginationKind) {
    case 'none':
      return undefined;
    case 'offset':
      return {
        kind: 'offset',
        limitParam: values.limitParam,
        offsetParam: values.offsetParam,
        pageSize,
      };
    case 'page':
      return {
        kind: 'page',
        pageParam: values.pageParam,
        sizeParam: nonEmpty(values.sizeParam),
        pageSize,
      };
    case 'cursor':
      return {
        kind: 'cursor',
        cursorParam: values.cursorParam,
        nextCursorPath: values.nextCursorPath,
        sizeParam: nonEmpty(values.sizeParam),
        pageSize,
      };
    case 'next-url':
      return { kind: 'next-url', nextUrlPath: values.nextUrlPath };
  }
}

/** The area filter as typed; either half alone is passed on, for the server to refuse. */
function spatialFilterOf(values: RestSourceForm): Record<string, unknown> | undefined {
  return values.areaParam === '' && values.areaTemplate === ''
    ? undefined
    : { param: values.areaParam, template: values.areaTemplate };
}

/** The config the create action submits; the domain validates every part of it. */
export function toRestConfig(values: RestSourceForm): Record<string, unknown> {
  return {
    baseUrl: values.baseUrl,
    authMode: values.authMode,
    recordsPath: nonEmpty(values.recordsPath),
    pagination: paginationOf(values),
    spatialFilter: spatialFilterOf(values),
  };
}

const CONFIG_PREFIX = 'config.';
const PAGINATION_PREFIX = 'config.pagination.';

/** Form fields whose name is not simply the last segment of the server's path. */
const RENAMED_FIELDS: Readonly<Record<string, string>> = {
  'config.pagination': 'paginationKind',
  'config.pagination.kind': 'paginationKind',
  'config.spatialFilter': 'areaParam',
  'config.spatialFilter.param': 'areaParam',
  'config.spatialFilter.template': 'areaTemplate',
};

function formFieldOf(serverPath: string): string {
  const renamed = RENAMED_FIELDS[serverPath];
  if (renamed !== undefined) {
    return renamed;
  }
  if (serverPath.startsWith(PAGINATION_PREFIX)) {
    return serverPath.slice(PAGINATION_PREFIX.length);
  }
  return serverPath.startsWith(CONFIG_PREFIX) ? serverPath.slice(CONFIG_PREFIX.length) : serverPath;
}

/**
 * The server reports problems by the path in the config it was sent
 * (`config.pagination.limitParam`); the form names the same fields without
 * that nesting. Without this the server's field errors would land on no input.
 */
export function toFormFieldErrors(error: SerializedActionError): SerializedActionError {
  if (error.fieldErrors === undefined) {
    return error;
  }
  return {
    ...error,
    fieldErrors: Object.fromEntries(
      Object.entries(error.fieldErrors).map(([path, codes]) => [formFieldOf(path), codes]),
    ),
  };
}

/** The pagination fields as the form shows them; `toRestConfig` turns them back into a strategy. */
function paginationFieldsOf(
  pagination: RestConnectionSettingsView['pagination'],
): Partial<RestSourceForm> {
  switch (pagination.kind) {
    case 'none':
      return {};
    case 'offset':
      return {
        limitParam: pagination.limitParam,
        offsetParam: pagination.offsetParam,
        pageSize: String(pagination.pageSize),
      };
    case 'page':
      return {
        pageParam: pagination.pageParam,
        sizeParam: pagination.sizeParam ?? '',
        pageSize: String(pagination.pageSize),
      };
    case 'cursor':
      return {
        cursorParam: pagination.cursorParam,
        nextCursorPath: pagination.nextCursorPath,
        sizeParam: pagination.sizeParam ?? '',
        pageSize: String(pagination.pageSize),
      };
    case 'next-url':
      return { nextUrlPath: pagination.nextUrlPath };
  }
}

/** A stored source as the form's starting values: the inverse of `toRestConfig`. */
export function toRestSourceForm(settings: DataSourceSettingsView): RestSourceForm {
  const { connection } = settings;
  if (connection === null) {
    return { ...REST_SOURCE_FORM_DEFAULTS, name: settings.name };
  }
  return {
    ...REST_SOURCE_FORM_DEFAULTS,
    name: settings.name,
    baseUrl: connection.baseUrl,
    authMode: connection.authMode,
    recordsPath: connection.recordsPath ?? '',
    paginationKind: connection.pagination.kind,
    ...paginationFieldsOf(connection.pagination),
    areaParam: connection.spatialFilter?.param ?? '',
    areaTemplate: connection.spatialFilter?.template ?? '',
  };
}
