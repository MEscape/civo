import { ROOT_FIELD, validationError, fieldPath } from '@lib/errors';
import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import type { ZodType } from 'zod';

interface IssueLike {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

function collectFieldErrors(issues: readonly IssueLike[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const path = issue.path.length > 0 ? fieldPath(...issue.path.map(String)) : ROOT_FIELD;
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export type ActionInputParser = <TOutput>(
  schema: ZodType<TOutput>,
  input: unknown,
) => AppResult<TOutput, ValidationAppError>;

/**
 * Validates untrusted Server Action input and reports failure in the shared
 * error model. `code` is the owning module's "invalid input" code.
 */
export function createActionInputParser(code: string): ActionInputParser {
  return (schema, input) => {
    const parsed = schema.safeParse(input);
    if (parsed.success) {
      return ok(parsed.data);
    }
    return err(
      validationError(
        code,
        'The request input is invalid.',
        collectFieldErrors(parsed.error.issues),
      ),
    );
  };
}
