import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';

import { useTranslations } from '@i18n/client';

import { messagesByPath } from '../forms/field-errors';
import { newServiceValues, toServiceFormValues } from '../forms/service-form-values';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { serviceInputSchema } from '../schemas/service-schema';

import type { ServiceDto } from '../dto/service-dto';
import type { ServiceFormValues } from '../schemas/service-schema';

/**
 * The form of a service: one react-hook-form value checked by the rules the server applies, with what
 * it started from (a change to what locations share is a difference from it) and a way to turn the
 * error codes into the words of the current language. Reports unsaved work to the surrounding guard.
 */
export function useServiceForm(service: ServiceDto | null) {
  const t = useTranslations('booking');
  const [initial] = useState(() =>
    service === null ? newServiceValues() : toServiceFormValues(service),
  );
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceInputSchema),
    defaultValues: initial,
  });
  useReportUnsavedChanges(form.formState.isDirty);

  /** The message of one code, in the current language, for a field. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  /** The messages under a part of the form's errors, by path inside it, already translated. */
  const translateErrors = (subtree: unknown): Record<string, string> =>
    Object.fromEntries(
      Object.entries(messagesByPath(subtree)).map(([path, code]) => [
        path,
        errorText(code) ?? code,
      ]),
    );

  return { form, initial, errorText, translateErrors };
}
