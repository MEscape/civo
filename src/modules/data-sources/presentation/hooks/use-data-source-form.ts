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

import { AUTH_MODES } from '../../application/contracts/data-source-constraints';
import { createDataSourceAction } from '../actions/create-data-source-action';
import { testDataSourceConnectionAction } from '../actions/test-data-source-connection-action';
import { updateDataSourceAction } from '../actions/update-data-source-action';
import { SOURCE_FORM_STEPS, SOURCE_STEP_FIELDS } from '../forms/source-form-steps';
import {
  AUTH_MODE_MESSAGE_KEYS,
  MESSAGE_PARAMS,
  messageKeyForCode,
} from '../messages/message-keys';
import { dataSourceRoutes } from '../routes';
import { toFormFieldErrors, toRestConfig } from '../schemas/rest-source-config-schema';
import {
  REST_SOURCE_FORM_DEFAULTS,
  restSourceFormSchema,
} from '../schemas/rest-source-form-schema';

import type { SourceFormStep } from '../forms/source-form-steps';
import type { RestSourceForm } from '../schemas/rest-source-form-schema';

/** A stored source to edit: its id and the form's starting values (never a stored credential). */
export interface EditedSource {
  readonly id: string;
  readonly values: RestSourceForm;
  /** The stored address has a query or fragment the form leaves out; kept unless the address changes. */
  readonly hasHiddenUrlParts: boolean;
}

interface DataSourceFormOptions {
  readonly websiteId: string;
  readonly step: SourceFormStep;
  /** Absent: a new source is connected. */
  readonly source?: EditedSource | undefined;
}

/** The state of the connect-or-edit source form: its fields, the submit, and what the server answered. */
export function useDataSourceForm({ websiteId, step, source }: DataSourceFormOptions) {
  const t = useTranslations('dataSources');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const form = useForm<RestSourceForm>({
    resolver: zodResolver(restSourceFormSchema),
    defaultValues: source?.values ?? REST_SOURCE_FORM_DEFAULTS,
  });
  const { errors, isDirty } = form.formState;
  useReportUnsavedChanges(isDirty);
  const wizard = useWizardSteps({
    steps: SOURCE_FORM_STEPS,
    fields: SOURCE_STEP_FIELDS,
    step,
    form,
  });

  function handleSubmit(values: RestSourceForm) {
    setFormErrorCode(null);
    startTransition(async () => {
      const fields = { name: values.name, config: toRestConfig(values) };
      const result = source
        ? await updateDataSourceAction({ dataSourceId: source.id, ...fields })
        : await createDataSourceAction({ websiteId, kind: 'REST', ...fields });
      if (!result.ok) {
        const error = toFormFieldErrors(result.error);
        setFormErrorCode(applyActionError(error, form.setError));
        wizard.showErrors(Object.keys(error.fieldErrors ?? {}));
        return;
      }
      form.reset(values);
      if (source) {
        // `test=1` has the source's page test a changed connection as it opens.
        router.replace(`${dataSourceRoutes.source(websiteId, result.data.id)}?test=1`);
        return;
      }
      // A new source is tested right away so the person goes on to add its first dataset; a failed
      // test lands on the source's page, which names the problem and offers the fix.
      const test = await testDataSourceConnectionAction(result.data.id);
      router.replace(
        test.ok && test.data.outcome.isHealthy
          ? dataSourceRoutes.datasetNew(websiteId, result.data.id)
          : dataSourceRoutes.source(websiteId, result.data.id),
      );
    });
  }

  let submitLabel = source ? t('sourceForm.save') : t('sourceForm.connect');
  if (isPending) {
    submitLabel = t('sourceForm.saving');
  }

  return {
    form,
    errors,
    wizard,
    isEditing: source !== undefined,
    hasHiddenUrlParts: source?.hasHiddenUrlParts ?? false,
    submitLabel,
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
    isPending,
    formErrorCode,
    authModeOptions: AUTH_MODES.map((mode) => ({
      value: mode,
      label: t(AUTH_MODE_MESSAGE_KEYS[mode]),
    })),
    /** A field's error code as text in this module's language; `undefined` while the field is valid. */
    errorText: (code: string | undefined) =>
      code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS),
  };
}
