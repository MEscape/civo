'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { FormSelectField } from '@components/shared/form-select-field';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';

import { useBeforeUnloadGuard } from '@hooks/use-before-unload-guard';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { AUTH_MODES } from '../../application/contracts/data-source-constraints';
import { createDataSourceAction } from '../actions/create-data-source-action';
import {
  AUTH_MODE_MESSAGE_KEYS,
  MESSAGE_PARAMS,
  messageKeyForCode,
} from '../messages/message-keys';
import { toFormFieldErrors, toRestConfig } from '../schemas/rest-source-config-schema';
import {
  REST_SOURCE_FORM_DEFAULTS,
  restSourceFormSchema,
} from '../schemas/rest-source-form-schema';

import { DataSourcePaginationFields } from './data-source-pagination-fields';

import type { RestSourceForm } from '../schemas/rest-source-form-schema';

export interface DataSourceFormProps {
  readonly websiteId: string;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

export function DataSourceForm({ websiteId, onCancel, onSaved }: DataSourceFormProps) {
  const t = useTranslations('dataSources');
  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const form = useForm<RestSourceForm>({
    resolver: zodResolver(restSourceFormSchema),
    defaultValues: REST_SOURCE_FORM_DEFAULTS,
  });
  const { errors, isDirty } = form.formState;
  useBeforeUnloadGuard(isDirty);
  const authMode = useWatch({ control: form.control, name: 'authMode' });

  const authModeOptions = AUTH_MODES.map((mode) => ({
    value: mode,
    label: t(AUTH_MODE_MESSAGE_KEYS[mode]),
  }));

  const nameId = `${id}-name`;
  const baseUrlId = `${id}-base-url`;

  function handleSubmit(values: RestSourceForm) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await createDataSourceAction({
        websiteId,
        name: values.name,
        kind: 'REST',
        config: toRestConfig(values),
      });
      if (!result.ok) {
        setFormErrorCode(applyActionError(toFormFieldErrors(result.error), form.setError));
        return;
      }
      onSaved();
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
      aria-busy={isPending}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <TextField
          id={nameId}
          label={t('sourceForm.name')}
          placeholder={t('sourceForm.namePlaceholder')}
          error={errorText(errors.name?.message)}
          {...form.register('name')}
        />
        <FormSelectField
          control={form.control}
          name="authMode"
          id={`${id}-auth-mode`}
          label={t('sourceForm.authMode')}
          options={authModeOptions}
          errorText={errorText}
        />
      </div>

      <TextField
        id={baseUrlId}
        type="url"
        inputMode="url"
        autoComplete="off"
        label={t('sourceForm.baseUrl')}
        placeholder={t('sourceForm.baseUrlPlaceholder')}
        error={errorText(errors.baseUrl?.message)}
        {...form.register('baseUrl')}
      />

      {authMode !== 'NONE' && (
        <p className="text-xs text-copy-muted">{t('sourceForm.credentialHint')}</p>
      )}

      <DataSourcePaginationFields
        idPrefix={id}
        control={form.control}
        register={form.register}
        errors={errors}
        errorText={errorText}
      />

      {formErrorCode !== null && (
        <FieldMessage
          id={`${id}-form-error`}
          message={t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)}
          className="text-sm"
        />
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('sourceForm.saving') : t('sourceForm.save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          {t('sourceForm.cancel')}
        </Button>
      </div>
    </form>
  );
}
