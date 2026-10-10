import { useState, useTransition } from 'react';

import type { ActionResult } from '@lib/result';

import { NO_ERRORS } from '../components/shared/form-error-summary';

import type { FormErrors } from '../components/shared/form-error-summary';
import type { ZodType } from 'zod';

export interface SaveFormOptions<TDraft, TResult> {
  /** The same schema the server action uses, run first so obvious mistakes need no round trip. */
  readonly schema: ZodType<TDraft>;
  readonly save: (draft: TDraft) => Promise<ActionResult<TResult>>;
  readonly onSaved: (saved: TResult) => void;
}

export interface SaveForm {
  readonly errors: FormErrors;
  readonly isPending: boolean;
  readonly submit: (draft: unknown) => void;
  readonly clearErrors: () => void;
}

function pathOf(path: readonly PropertyKey[]): string {
  return path.map(String).join('.');
}

/**
 * Submit handling shared by the configuration forms: validate in the browser,
 * call the server action, and turn a failure into errors per field plus one
 * for the form as a whole. The draft is kept on failure, so nothing typed is
 * lost; the server repeats every check.
 */
export function useSaveForm<TDraft, TResult>({
  schema,
  save,
  onSaved,
}: SaveFormOptions<TDraft, TResult>): SaveForm {
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS);
  const [isPending, startTransition] = useTransition();

  function submit(draft: unknown) {
    const parsed = schema.safeParse(draft);
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        (fields[pathOf(issue.path)] ??= []).push(issue.message);
      }
      setErrors({ fields, formCode: null });
      return;
    }
    setErrors(NO_ERRORS);
    startTransition(async () => {
      const result = await save(parsed.data);
      if (result.ok) {
        onSaved(result.data);
        return;
      }
      const fields = result.error.fieldErrors ?? {};
      setErrors({
        fields,
        formCode: Object.keys(fields).length > 0 ? null : result.error.code,
      });
    });
  }

  return {
    errors,
    isPending,
    submit,
    clearErrors: () => {
      setErrors(NO_ERRORS);
    },
  };
}
