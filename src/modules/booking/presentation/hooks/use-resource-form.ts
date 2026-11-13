import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';

import { useTranslations } from '@i18n/client';

import { messagesByPath } from '../forms/field-errors';
import { newResourceValues, toResourceFormValues } from '../forms/resource-form-values';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { resourceFormSchema } from '../schemas/resource-schema';

import type { DayDto } from '../dto/location-dto';
import type { ResourceDto } from '../dto/resource-dto';
import type { ResourceFormValues } from '../schemas/resource-schema';

/**
 * The form of a resource: one react-hook-form value checked by the rules the server applies, with
 * what it started from (the change is judged against it) and the error codes turned into the words
 * of the current language. Reports unsaved work to the surrounding guard.
 */
export function useResourceForm(resource: ResourceDto | null, locationWeekly: readonly DayDto[]) {
  const t = useTranslations('booking');
  const [initial] = useState(() =>
    resource === null ? newResourceValues(locationWeekly) : toResourceFormValues(resource),
  );
  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: initial,
  });
  useReportUnsavedChanges(form.formState.isDirty);

  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  /** The messages under a part of the form's errors, by path inside it, already translated. */
  const translateErrors = (subtree: unknown): Record<string, string> =>
    Object.fromEntries(
      Object.entries(messagesByPath(subtree)).map(([path, code]) => [
        path,
        t(messageKeyForCode(code), MESSAGE_PARAMS),
      ]),
    );

  return { form, initial, errorText, translateErrors };
}
