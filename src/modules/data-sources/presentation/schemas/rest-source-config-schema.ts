import type { SerializedActionError } from '@lib/result';

import type { RestSourceForm } from './rest-source-form-schema';

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

/** The config the create action submits; the domain validates every part of it. */
export function toRestConfig(values: RestSourceForm): Record<string, unknown> {
  return {
    baseUrl: values.baseUrl,
    authMode: values.authMode,
    recordsPath: nonEmpty(values.recordsPath),
    pagination: paginationOf(values),
  };
}

const CONFIG_PREFIX = 'config.';
const PAGINATION_PREFIX = 'config.pagination.';

/** Form fields whose name is not simply the last segment of the server's path. */
const RENAMED_FIELDS: Readonly<Record<string, string>> = {
  'config.pagination': 'paginationKind',
  'config.pagination.kind': 'paginationKind',
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
