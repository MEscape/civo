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

import {
  CANONICAL_KINDS,
  DATA_SOURCE_ERROR_CODES,
} from '../../application/contracts/data-source-constraints';
import { createDatasetAction } from '../actions/create-dataset-action';
import { updateDatasetAction } from '../actions/update-dataset-action';
import {
  CANONICAL_KIND_MESSAGE_KEYS,
  MESSAGE_PARAMS,
  messageKeyForCode,
} from '../messages/message-keys';
import { datasetFormSchema } from '../schemas/new-dataset-schema';

import type { DatasetDto } from '../dto/dataset-dto';
import type { DatasetForm as DatasetFormValues } from '../schemas/new-dataset-schema';

export interface DatasetFormProps {
  readonly dataSourceId: string;
  readonly dataset?: DatasetDto;
  readonly onSaved: (dataset: DatasetDto) => void;
  readonly onCancel: () => void;
}

const DEFAULT_CANONICAL_KIND = CANONICAL_KINDS[0];

export function DatasetForm({ dataSourceId, dataset, onSaved, onCancel }: DatasetFormProps) {
  const t = useTranslations('dataSources');
  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const form = useForm<DatasetFormValues>({
    resolver: zodResolver(datasetFormSchema),
    defaultValues: {
      name: dataset?.name ?? '',
      canonicalKind: dataset?.canonicalKind ?? DEFAULT_CANONICAL_KIND,
    },
  });
  const { errors } = form.formState;
  const nameId = `${id}-name`;

  function handleSubmit(values: DatasetFormValues) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = dataset
        ? await updateDatasetAction({ datasetId: dataset.id, ...values })
        : await createDatasetAction({ dataSourceId, ...values });
      if (!result.ok) {
        setFormErrorCode(
          applyActionError(result.error, form.setError, {
            [DATA_SOURCE_ERROR_CODES.datasetSlugTaken]: 'name',
          }),
        );
        return;
      }
      router.refresh();
      onSaved(result.data);
    });
  }

  let submitLabel = t('datasetForm.add');
  if (isPending) {
    submitLabel = t('datasetForm.saving');
  } else if (dataset) {
    submitLabel = t('datasetForm.save');
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
      aria-busy={isPending}
      className="space-y-6"
    >
      <h4 className="font-medium text-copy">
        {dataset ? t('datasetForm.titleEdit') : t('datasetForm.title')}
      </h4>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <TextField
          id={nameId}
          label={t('datasetForm.name')}
          placeholder={t('datasetForm.namePlaceholder')}
          error={errorText(errors.name?.message)}
          {...form.register('name')}
        />
        <SelectField
          id={`${id}-kind`}
          label={t('datasetForm.kind')}
          errorMessage={errorText(errors.canonicalKind?.message)}
          {...form.register('canonicalKind')}
        >
          {CANONICAL_KINDS.map((type) => (
            <option key={type} value={type}>
              {t(CANONICAL_KIND_MESSAGE_KEYS[type])}
            </option>
          ))}
        </SelectField>
      </div>

      {formErrorCode !== null && (
        <FieldMessage
          id={`${id}-form-error`}
          message={t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)}
          className="text-sm"
        />
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          {t('datasetForm.cancel')}
        </Button>
      </div>
    </form>
  );
}
