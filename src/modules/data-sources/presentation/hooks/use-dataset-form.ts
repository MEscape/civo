'use client';

import { useState, useTransition } from 'react';
import type { SyntheticEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';
import { useWizardSteps } from '@hooks/use-wizard-steps';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import {
  CANONICAL_KINDS,
  DATA_SOURCE_ERROR_CODES,
} from '../../application/contracts/data-source-constraints';
import { createDatasetAction } from '../actions/create-dataset-action';
import { updateDatasetAction } from '../actions/update-dataset-action';
import { DATASET_FORM_STEPS, DATASET_STEP_FIELDS } from '../forms/dataset-form-steps';
import {
  CANONICAL_KIND_MESSAGE_KEYS,
  MESSAGE_PARAMS,
  messageKeyForCode,
} from '../messages/message-keys';
import { dataSourceRoutes } from '../routes';
import { datasetFormSchema } from '../schemas/new-dataset-schema';

import type { DatasetDto } from '../dto/dataset-dto';
import type { DatasetFormStep } from '../forms/dataset-form-steps';
import type { DatasetForm as DatasetFormValues } from '../schemas/new-dataset-schema';

const DEFAULT_CANONICAL_KIND = CANONICAL_KINDS[0];

function toDefaultValues(dataset: DatasetDto | undefined): DatasetFormValues {
  return {
    name: dataset?.name ?? '',
    canonicalKind: dataset?.canonicalKind ?? DEFAULT_CANONICAL_KIND,
    path: dataset?.path ?? '',
  };
}

interface DatasetFormOptions {
  readonly dataSourceId: string;
  readonly dataset?: DatasetDto | undefined;
  readonly websiteId: string;
  readonly step: DatasetFormStep;
}

/** The state of the add-or-edit dataset form: its fields, the submit, and what the server answered. */
export function useDatasetForm({ dataSourceId, dataset, websiteId, step }: DatasetFormOptions) {
  const t = useTranslations('dataSources');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const form = useForm<DatasetFormValues>({
    resolver: zodResolver(datasetFormSchema),
    defaultValues: toDefaultValues(dataset),
  });
  const { errors, isDirty } = form.formState;
  useReportUnsavedChanges(isDirty);
  const wizard = useWizardSteps({
    steps: DATASET_FORM_STEPS,
    fields: DATASET_STEP_FIELDS,
    step,
    form,
  });

  function handleSubmit(values: DatasetFormValues) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = dataset
        ? await updateDatasetAction({ datasetId: dataset.id, name: values.name, path: values.path })
        : await createDatasetAction({ dataSourceId, ...values });
      if (!result.ok) {
        const error = {
          ...result.error,
          ...(result.error.fieldErrors === undefined
            ? {}
            : {
                fieldErrors: Object.fromEntries(
                  Object.entries(result.error.fieldErrors).map(([field, codes]) => [
                    field === 'slug' ? 'name' : field,
                    codes,
                  ]),
                ),
              }),
        };
        setFormErrorCode(
          applyActionError(error, form.setError, {
            [DATA_SOURCE_ERROR_CODES.datasetSlugTaken]: 'name',
          }),
        );
        wizard.showErrors(
          error.code === DATA_SOURCE_ERROR_CODES.datasetSlugTaken
            ? ['name']
            : Object.keys(error.fieldErrors ?? {}),
        );
        return;
      }
      form.reset(values);
      // A new dataset goes on to its mapping, the next step; an edited one back to its source.
      router.replace(
        dataset
          ? dataSourceRoutes.source(websiteId, dataSourceId)
          : dataSourceRoutes.datasetMapping(websiteId, dataSourceId, result.data.id),
      );
    });
  }

  let submitLabel = t('datasetForm.add');
  if (isPending) {
    submitLabel = t('datasetForm.saving');
  } else if (dataset) {
    submitLabel = t('datasetForm.save');
  }

  return {
    form,
    errors,
    isPending,
    formErrorCode,
    submitLabel,
    kindOptions: CANONICAL_KINDS.map((kind) => ({
      value: kind,
      label: t(CANONICAL_KIND_MESSAGE_KEYS[kind]),
    })),
    /** A field's error code as text in this module's language; `undefined` while the field is valid. */
    errorText: (code: string | undefined) =>
      code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS),
    wizard,
    onSubmit: (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!wizard.isLast) {
        void wizard.goNext();
        return;
      }
      void form.handleSubmit(handleSubmit, (invalid) => {
        wizard.showErrors(Object.keys(invalid));
      })(event);
    },
  };
}
