'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { useRouter } from '@i18n';

import { applyActionError } from '@lib/actions';

import { saveEmployeePreferencesAction } from '../actions/save-employee-preferences-action';
import { toggleId } from '../forms/preferences';
import { minutesOf } from '../forms/week/time';
import { preferencesFormSchema } from '../schemas/employee-schema';

import { useBookingWebsite } from './use-booking-website';

import type { PreferencesDto } from '../dto/employee-dto';
import type { RangeDto } from '../dto/location-dto';
import type { SavePreferencesValues } from '../schemas/employee-schema';

/** A window someone starts from when they switch one on: the morning. */
const DEFAULT_WINDOW = { startMinute: 480, endMinute: 780 };

const valuesOf = (view: PreferencesDto): SavePreferencesValues => ({
  serviceIds: [...view.serviceIds],
  window: view.window,
});

/**
 * The preferences form: the chosen services and the part of the day, saved in one go. "Saved" is shown only after the server confirmed it; a refusal is shown at its field.
 */
export function usePreferencesForm(view: PreferencesDto) {
  const router = useRouter();
  const websiteId = useBookingWebsite();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaved, setSaved] = useState(false);
  const form = useForm<SavePreferencesValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: valuesOf(view),
  });
  const [serviceIds, window] = useWatch({
    control: form.control,
    name: ['serviceIds', 'window'],
  });
  const touched = { shouldDirty: true } as const;
  const changed = () => {
    setSaved(false);
  };
  const setWindow = (value: SavePreferencesValues['window']) => {
    changed();
    form.setValue('window', value, touched);
  };

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveEmployeePreferencesAction({ websiteId, ...values });
      if (!result.ok) {
        setFormError(applyActionError(result.error, form.setError));
        return;
      }
      form.reset({
        serviceIds: [...result.data.serviceIds],
        window: result.data.window,
      });
      setSaved(true);
      router.refresh();
    });
  });

  return {
    form,
    values: { serviceIds, window },
    isPending,
    isSaved,
    formError,
    submit,
    reset: () => {
      setSaved(false);
      form.reset(valuesOf(view));
    },
    toggleService: (id: string) => {
      changed();
      form.setValue('serviceIds', toggleId(serviceIds, id), touched);
    },
    setWindow: (range: RangeDto | null) => {
      setWindow(
        range === null
          ? null
          : {
              startMinute: minutesOf(range.start) ?? Number.NaN,
              endMinute: minutesOf(range.end) ?? Number.NaN,
            },
      );
    },
    addWindow: () => {
      setWindow(DEFAULT_WINDOW);
    },
  };
}
