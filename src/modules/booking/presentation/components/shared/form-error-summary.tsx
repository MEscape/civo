'use client';

import { useEffect, useRef } from 'react';

import { useTranslations } from '@i18n/client';

import { useFieldPathLabel } from '../../hooks/use-field-path-label';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

export interface FormErrors {
  /** Field path (`name`, `openingHours.weekly.0.intervals`) -> codes. */
  readonly fields: Readonly<Record<string, readonly string[]>>;
  /** A problem with the form as a whole (not allowed, not found, storage failed). */
  readonly formCode: string | null;
}

export const NO_ERRORS: FormErrors = { fields: {}, formCode: null };

export function hasErrors(errors: FormErrors): boolean {
  return errors.formCode !== null || Object.keys(errors.fields).length > 0;
}

/** True when any problem is at `prefix` or below it (`openingHours.exceptions.3`). */
export function hasErrorsUnder(errors: FormErrors, prefix: string): boolean {
  return Object.keys(errors.fields).some(
    (path) => path === prefix || path.startsWith(`${prefix}.`),
  );
}

/** The first message for a field, or `undefined`. */
export function firstCode(errors: FormErrors, field: string): string | undefined {
  return errors.fields[field]?.[0];
}

export interface FormErrorSummaryProps {
  readonly errors: FormErrors;
  /** Field paths with their own error text, so the summary lists only the rest. */
  readonly shownAtField: readonly string[];
}

/**
 * Everything that went wrong, in one place that takes focus after a failed
 * save. Problems on named fields are also repeated at the field; the rest
 * (nested schedule rows, the form as a whole) appear here, said in words
 * ("Exception 14 · From date"), and the row or day they belong to is marked
 * where it is, so no error is ever lost because a path was not matched.
 */
export function FormErrorSummary({ errors, shownAtField }: FormErrorSummaryProps) {
  const t = useTranslations('booking');
  const labelOf = useFieldPathLabel();
  const ref = useRef<HTMLDivElement>(null);
  const lines = Object.entries(errors.fields).filter(([path]) => !shownAtField.includes(path));

  const present = hasErrors(errors);
  useEffect(() => {
    if (present) {
      ref.current?.focus();
    }
  }, [present, errors]);

  if (!present) {
    return null;
  }

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="rounded-token border border-danger-border bg-danger-subtle p-4 text-sm text-danger"
    >
      <p className="font-medium">{t('form.errorSummary')}</p>
      {errors.formCode !== null && (
        <p className="mt-1">{t(messageKeyForCode(errors.formCode), MESSAGE_PARAMS)}</p>
      )}
      {lines.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {lines.map(([path, codes]) => {
            const where = labelOf(path);
            return (
              <li key={path}>
                {where !== null && <span className="font-medium">{where}: </span>}
                {codes.map((code) => t(messageKeyForCode(code), MESSAGE_PARAMS)).join(', ')}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
