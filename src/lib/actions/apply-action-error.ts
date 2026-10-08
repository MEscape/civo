import { ROOT_FIELD } from '@lib/errors';
import type { SerializedActionError } from '@lib/result';

import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

/**
 * Puts a failed action's field errors onto the form (focusing the first)
 * so input is preserved and the user lands on the problem.
 *
 * `codeFields` routes a form-level code to a field (for example "slug
 * taken" belongs on the slug input). Returns the code to show as a
 * form-level message, or `null` when the error was placed on a field.
 */
export function applyActionError<TValues extends FieldValues>(
  error: SerializedActionError,
  setError: UseFormSetError<TValues>,
  codeFields: Readonly<Record<string, FieldPath<TValues>>> = {},
): string | null {
  const routedField = codeFields[error.code];
  if (routedField !== undefined) {
    setError(routedField, { type: 'server', message: error.code }, { shouldFocus: true });
    return null;
  }

  const fieldEntries = Object.entries(error.fieldErrors ?? {}).filter(
    ([path]) => path !== ROOT_FIELD,
  );
  fieldEntries.forEach(([path, codes], index) => {
    const [first] = codes;
    if (first === undefined) {
      return;
    }
    // The server names fields by dotted path; react-hook-form cannot verify that at compile time.
    setError(
      path as FieldPath<TValues>,
      { type: 'server', message: first },
      { shouldFocus: index === 0 },
    );
  });

  return fieldEntries.length > 0 ? null : error.code;
}
