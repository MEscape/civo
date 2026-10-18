'use client';

import { useId, useState, useTransition } from 'react';
import type { ReactNode } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { FormSelectField } from '@components/shared/form-select-field';
import { TextField } from '@components/shared/text-field';
import { useReportUnsavedChanges } from '@components/shared/unsaved-changes-guard';
import { Button } from '@components/ui/button';
import { ChevronRight, Info } from '@components/ui/icons';

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

/** The fields under the advanced part; an error there opens it, so it is never hidden. */
const ADVANCED_FIELDS = [
  'recordsPath',
  'paginationKind',
  'limitParam',
  'offsetParam',
  'pageParam',
  'sizeParam',
  'cursorParam',
  'nextCursorPath',
  'nextUrlPath',
  'pageSize',
] as const satisfies ReadonlyArray<keyof RestSourceForm>;

/** One numbered part of the form: what it asks, why, and its fields. */
function FormStep({
  number,
  title,
  description,
  children,
}: {
  readonly number: number;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-8">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3" aria-hidden="true">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {number}
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-copy">{title}</p>
          <p className="text-xs text-copy-muted">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

/**
 * Connecting a source, in the order a newcomer thinks about it: what to call
 * it, where the data is, and (folded away, because the defaults detect the
 * common layouts) how the API wraps and pages its records.
 */
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
  useReportUnsavedChanges(isDirty);
  const authMode = useWatch({ control: form.control, name: 'authMode' });
  const hasAdvancedError = ADVANCED_FIELDS.some((field) => errors[field] !== undefined);

  const authModeOptions = AUTH_MODES.map((mode) => ({
    value: mode,
    label: t(AUTH_MODE_MESSAGE_KEYS[mode]),
  }));

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
      className="space-y-8"
    >
      <FormStep
        number={1}
        title={t('sourceForm.steps.identity.title')}
        description={t('sourceForm.steps.identity.description')}
      >
        <TextField
          id={`${id}-name`}
          label={t('sourceForm.name')}
          placeholder={t('sourceForm.namePlaceholder')}
          error={errorText(errors.name?.message)}
          {...form.register('name')}
        />
      </FormStep>

      <FormStep
        number={2}
        title={t('sourceForm.steps.location.title')}
        description={t('sourceForm.steps.location.description')}
      >
        <TextField
          id={`${id}-base-url`}
          type="url"
          inputMode="url"
          autoComplete="off"
          label={t('sourceForm.baseUrl')}
          hint={t('sourceForm.baseUrlHint')}
          placeholder={t('sourceForm.baseUrlPlaceholder')}
          error={errorText(errors.baseUrl?.message)}
          {...form.register('baseUrl')}
        />
        <FormSelectField
          control={form.control}
          name="authMode"
          id={`${id}-auth-mode`}
          label={t('sourceForm.authMode')}
          options={authModeOptions}
          errorText={errorText}
        />
        {authMode !== 'NONE' && (
          <p className="flex gap-2 rounded-token border border-info-border bg-info-subtle px-3 py-2 text-xs text-copy">
            <Info className="mt-px size-3.5 shrink-0 text-info" aria-hidden="true" />
            {t('sourceForm.credentialHint')}
          </p>
        )}
      </FormStep>

      {/* `open` follows an error so an invalid field is never folded away. */}
      <details
        className="group rounded-token border border-border bg-canvas/50"
        open={hasAdvancedError ? true : undefined}
      >
        <summary className="flex cursor-pointer list-none items-start gap-3 rounded-token px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="mt-0.5 size-4 shrink-0 text-copy-muted transition-transform group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden="true"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium text-copy">
              {t('sourceForm.steps.advanced.title')}
            </span>
            <span className="block text-xs text-copy-muted">
              {t('sourceForm.steps.advanced.description')}
            </span>
          </span>
        </summary>
        <div className="border-t border-border p-4">
          <DataSourcePaginationFields
            idPrefix={id}
            control={form.control}
            register={form.register}
            errors={errors}
            errorText={errorText}
          />
        </div>
      </details>

      {formErrorCode !== null && (
        <FieldMessage
          id={`${id}-form-error`}
          message={t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)}
          className="text-sm"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-copy-muted">{t('sourceForm.afterSave')}</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            {t('sourceForm.cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? t('sourceForm.saving') : t('sourceForm.connect')}
          </Button>
        </div>
      </div>
    </form>
  );
}
