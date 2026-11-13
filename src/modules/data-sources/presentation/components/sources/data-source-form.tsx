'use client';

import { useId } from 'react';

import { FieldMessage } from '@components/shared/field';
import { Wizard, WizardActions } from '@components/shared/wizard';

import { useTranslations } from '@i18n/client';

import { SOURCE_FORM_STEPS, SOURCE_STEP_LABELS } from '../../forms/source-form-steps';
import { useDataSourceForm } from '../../hooks/use-data-source-form';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { dataSourceRoutes } from '../../routes';

import { DataSourceFormFields } from './data-source-form-fields';

import type { SourceFormStep } from '../../forms/source-form-steps';
import type { EditedSource } from '../../hooks/use-data-source-form';

interface DataSourceFormProps {
  readonly websiteId: string;
  readonly step: SourceFormStep;
  /** Absent: a new source is connected. */
  readonly source?: EditedSource | undefined;
}

/** Connecting a source, or editing one, in the same three steps: connection, records, review. */
export function DataSourceForm({ websiteId, step, source }: DataSourceFormProps) {
  const t = useTranslations('dataSources');
  const id = useId();
  const screen = useDataSourceForm({ websiteId, step, source });

  return (
    <form noValidate aria-busy={screen.isPending} onSubmit={screen.onSubmit}>
      <Wizard
        steps={SOURCE_FORM_STEPS.map((key) => ({ key, label: t(SOURCE_STEP_LABELS[key]) }))}
        currentKey={step}
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
            cancelHref={
              source
                ? dataSourceRoutes.source(websiteId, source.id)
                : dataSourceRoutes.sources(websiteId)
            }
            hasPrevious={screen.wizard.previous !== undefined}
            nextLabel={
              screen.wizard.next === undefined
                ? undefined
                : t('form.next', { step: t(SOURCE_STEP_LABELS[screen.wizard.next]) })
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
        <DataSourceFormFields key={step} id={id} step={step} screen={screen} />
      </Wizard>
    </form>
  );
}
