import type { AppError } from '@lib/errors';
import { unique } from '@lib/utils';

import { err, ok } from './app-result';

import type { AppResult } from './app-result';

/** How one module's id is recognised, branded and refused. */
export interface IdParserConfig<T, E extends AppError> {
  /** Whether the text has the shape of an id. */
  readonly isValid: (raw: string) => boolean;
  /** The one place the id's brand is applied, after `isValid` held. */
  readonly brand: (raw: string) => T;
  /** The module's own "invalid id" error. */
  readonly mapError: () => E;
}

/** A parser for request values that become a branded id, or the module's own error. */
export function createIdParser<T, E extends AppError>(config: IdParserConfig<T, E>) {
  return (raw: string): AppResult<T, E> =>
    config.isValid(raw) ? ok(config.brand(raw)) : err(config.mapError());
}

/**
 * The ids of a lookup by id: those that parse, each once, at most `limit`.
 * A malformed id cannot name anything, so it is dropped rather than failing
 * the whole lookup.
 */
export function parseValidIds<T>(
  raw: readonly string[],
  parse: (raw: string) => AppResult<T>,
  limit: number,
): T[] {
  return unique(raw)
    .slice(0, limit)
    .flatMap((id) =>
      parse(id).match(
        (parsed): T[] => [parsed],
        () => [],
      ),
    );
}
