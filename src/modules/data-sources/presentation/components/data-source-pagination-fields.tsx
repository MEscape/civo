'use client';

import { useWatch } from 'react-hook-form';

import { FormSelectField } from '@components/shared/form-select-field';
import { TextField } from '@components/shared/text-field';

import { useTranslations } from '@i18n/client';

import { PAGINATION_KINDS } from '../../application/contracts/data-source-constraints';
import { PAGINATION_KIND_MESSAGE_KEYS } from '../messages/message-keys';

import type { RestSourceForm } from '../schemas/rest-source-form-schema';
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';

export interface DataSourcePaginationFieldsProps {
  readonly idPrefix: string;
  readonly control: Control<RestSourceForm>;
  readonly register: UseFormRegister<RestSourceForm>;
  readonly errors: FieldErrors<RestSourceForm>;
  /** Turns a field's error code into translated text. */
  readonly errorText: (code: string | undefined) => string | undefined;
}

/** The field names a strategy asks for, in the order they are shown. */
const FIELDS_BY_KIND = {
  none: [],
  offset: ['limitParam', 'offsetParam', 'pageSize'],
  page: ['pageParam', 'sizeParam', 'pageSize'],
  cursor: ['cursorParam', 'nextCursorPath', 'sizeParam', 'pageSize'],
  'next-url': ['nextUrlPath'],
} as const satisfies Record<(typeof PAGINATION_KINDS)[number], readonly string[]>;

/**
 * Where the records are in the answer and how the API pages through them.
 * Both are explicit on purpose: what an API wraps its list in, and how it
 * continues, cannot be told reliably from one answer. Left alone, the
 * well-known envelopes are recognised and one request reads everything.
 */
export function DataSourcePaginationFields({
  idPrefix,
  control,
  register,
  errors,
  errorText,
}: DataSourcePaginationFieldsProps) {
  const t = useTranslations('dataSources');
  const kind = useWatch({ control, name: 'paginationKind' });

  const kindOptions = PAGINATION_KINDS.map((value) => ({
    value,
    label: t(PAGINATION_KIND_MESSAGE_KEYS[value]),
  }));

  return (
    <fieldset className="space-y-4 rounded-token-md border border-border p-4">
      <legend className="px-1 text-sm font-medium text-copy">
        {t('sourceForm.pagination.legend')}
      </legend>

      <TextField
        id={`${idPrefix}-records-path`}
        label={t('sourceForm.pagination.recordsPath')}
        hint={t('sourceForm.pagination.recordsPathHint')}
        placeholder="data.items"
        autoComplete="off"
        error={errorText(errors.recordsPath?.message)}
        {...register('recordsPath')}
      />

      <FormSelectField
        control={control}
        name="paginationKind"
        id={`${idPrefix}-pagination-kind`}
        label={t('sourceForm.pagination.kind')}
        options={kindOptions}
        errorText={errorText}
      />

      {kind !== 'none' && (
        <p className="text-xs text-copy-muted">{t(`sourceForm.pagination.hints.${kind}`)}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS_BY_KIND[kind].map((field) => (
          <TextField
            key={field}
            id={`${idPrefix}-${field}`}
            label={t(`sourceForm.pagination.fields.${field}`)}
            autoComplete="off"
            error={errorText(errors[field]?.message)}
            {...register(field)}
          />
        ))}
      </div>
    </fieldset>
  );
}
