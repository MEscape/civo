'use client';

import { useId, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { SelectField } from '@components/shared/select-field';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { AUTH_MODES } from '../../application/contracts/data-source-constraints';
import { createDataSourceAction } from '../actions/create-data-source-action';
import {
  AUTH_MODE_MESSAGE_KEYS,
  MESSAGE_PARAMS,
  messageKeyForCode,
} from '../messages/message-keys';
import { restSourceFormSchema } from '../schemas/rest-source-form-schema';

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

  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const form = useForm<RestSourceForm>({
    resolver: zodResolver(restSourceFormSchema),
    defaultValues: { name: '', baseUrl: '', authMode: 'NONE' },
  });
  const { errors } = form.formState;
  const authMode = form.watch('authMode');

  const nameId = `${id}-name`;
  const baseUrlId = `${id}-base-url`;

  function handleSubmit(values: RestSourceForm) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await createDataSourceAction({
        websiteId,
        name: values.name,
        kind: 'REST',
        config: { baseUrl: values.baseUrl, authMode: values.authMode },
      });
      if (!result.ok) {
        setFormErrorCode(applyActionError(result.error, form.setError));
        return;
      }
      router.refresh();
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
        <SelectField
          id={`${id}-auth-mode`}
          label={t('sourceForm.authMode')}
          errorMessage={errorText(errors.authMode?.message)}
          {...form.register('authMode')}
        >
          {AUTH_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t(AUTH_MODE_MESSAGE_KEYS[mode])}
            </option>
          ))}
        </SelectField>
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
