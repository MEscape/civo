'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useTranslations } from '@i18n/client';

import { detailsSchemaOf, detailsValuesOf } from '../forms/details-schema';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import type { CatalogServiceDto } from '../dto/catalog-dto';
import type { JourneyDetails } from '../forms/journey-state';

/**
 * The visitor's details for one service: the fields it asks for, filled with what they typed
 * before (a lost time does not empty the form). A failed submit focuses the first field in error.
 */
export function useDetailsForm(
  service: CatalogServiceDto,
  details: JourneyDetails,
  onDone: (details: JourneyDetails) => void,
) {
  const t = useTranslations('booking');
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(detailsSchemaOf(service)),
    defaultValues: detailsValuesOf(service, details),
  });
  const errorOf = (field: string) => {
    const code = form.formState.errors[field]?.message;
    return code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);
  };

  return { form, errorOf, submit: form.handleSubmit(onDone) };
}
