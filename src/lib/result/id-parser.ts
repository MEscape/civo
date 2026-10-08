import type { AppError } from '@lib/errors';

import { err, ok } from './app-result';

import type { AppResult } from './app-result';

export interface IdParserConfig<T, E extends AppError> {
  readonly isValid: (raw: string) => boolean;
  readonly brand: (raw: string) => T;
  readonly mapError: () => E;
}

export function createIdParser<T, E extends AppError>(config: IdParserConfig<T, E>) {
  return (raw: string): AppResult<T, E> =>
    config.isValid(raw) ? ok(config.brand(raw)) : err(config.mapError());
}
