'use client';

import { useId } from 'react';

import { FieldMessage } from '@components/shared/field';
import { Wizard, WizardActions } from '@components/shared/wizard';

import { useTranslations } from '@i18n/client';

import { DATASET_FORM_STEPS, DATASET_STEP_LABELS } from '../../forms/dataset-form-steps';
import { useDatasetForm } from '../../hooks/use-dataset-form';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { dataSourceRoutes } from '../../routes';

import { DatasetFormFields } from './dataset-form-fields';

import type { DatasetDto } from '../../dto/dataset-dto';
import type { DatasetFormStep } from '../../forms/dataset-form-steps';

interface DatasetFormProps {
  readonly websiteId: string;
  readonly dataSourceId: string;
  readonly dataset?: DatasetDto | undefined;
  readonly step: DatasetFormStep;
}

export function DatasetForm(props: DatasetFormProps) {
  const t = useTranslations('dataSources');
  const id = useId();
  const screen = useDatasetForm(props);
  return (
    <form noValidate aria-busy={screen.isPending} onSubmit={screen.onSubmit}>
      <Wizard
        currentKey={props.step}
        steps={DATASET_FORM_STEPS.map((key) => ({ key, label: t(DATASET_STEP_LABELS[key]) }))}
        status={
          <FieldMessage
            id={`${id}-error`}
            message={
              screen.formErrorCode === null
                ? undefined
                : t(messageKeyForCode(screen.formErrorCode), MESSAGE_PARAMS)
            }
          />
        }
        actions={
          <WizardActions
            cancelHref={dataSourceRoutes.source(props.websiteId, props.dataSourceId)}
            hasPrevious={screen.wizard.previous !== undefined}
            nextLabel={
              screen.wizard.next === undefined
                ? undefined
                : t('form.next', { step: t(DATASET_STEP_LABELS[screen.wizard.next]) })
            }
            saveLabel={screen.submitLabel}
            isPending={screen.isPending}
            onBack={screen.wizard.goBack}
            onNext={() => {
              void screen.wizard.goNext();
            }}
          />
        }
      >
        <DatasetFormFields
          key={props.step}
          id={id}
          step={props.step}
          screen={screen}
          isEditing={props.dataset !== undefined}
        />
      </Wizard>
    </form>
  );
}
