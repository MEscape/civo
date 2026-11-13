import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';

import { useTranslations } from '@i18n/client';

import { messagesByPath } from '../forms/field-errors';
import { newLocationValues, toFormValues } from '../forms/location-form-values';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { locationInputSchema } from '../schemas/location-schema';

import type { LocationDto } from '../dto/location-dto';
import type { LocationFormValues } from '../schemas/location-schema';

/**
 * The form of a location: one react-hook-form value checked by the rules the server applies, with
 * what it started from (the change is judged against it) and a way to turn the error codes of a
 * part of it into the words of the current language. Reports unsaved work to the surrounding guard.
 */
export function useLocationForm(location: LocationDto | null) {
  const t = useTranslations('booking');
  const [initial] = useState(() =>
    location === null ? newLocationValues() : toFormValues(location),
  );
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationInputSchema),
    defaultValues: initial,
  });
  useReportUnsavedChanges(form.formState.isDirty);

  /** The messages under a part of the form's errors, by path inside it, already translated. */
  const translateErrors = (subtree: unknown): Record<string, string> =>
    Object.fromEntries(
      Object.entries(messagesByPath(subtree)).map(([path, code]) => [
        path,
        t(messageKeyForCode(code), MESSAGE_PARAMS),
      ]),
    );

  return { form, initial, translateErrors };
}
