'use client';

import { useId } from 'react';

import { Wizard, WizardActions } from '@components/shared/wizard';

import { useTranslations } from '@i18n/client';

import { MAPPING_FORM_STEPS, MAPPING_STEP_LABELS } from '../../forms/mapping-form-steps';
import { useMappingWizard } from '../../hooks/use-mapping-wizard';
import { dataSourceRoutes } from '../../routes';

import { MappingFieldsStep } from './mapping-fields-step';
import { MappingFailure } from './mapping-progress';
import { MappingReviewStep } from './mapping-review-step';

import type {
  CanonicalKind,
  DatasetMappingView,
} from '../../../application/contracts/dataset-views';
import type { MappingFormStep } from '../../forms/mapping-form-steps';

interface MappingWizardProps {
  readonly websiteId: string;
  readonly sourceId: string;
  readonly datasetId: string;
  readonly canonicalKind: CanonicalKind;
  /** The mapping already saved, so reopening the wizard does not discard it. */
  readonly existingMapping: DatasetMappingView | null;
  readonly step: MappingFormStep;
}

/**
 * Discovery plus mapping as a wizard, like the source and dataset forms: the fields are read from the
 * live source as it opens, a first assignment is suggested from their names, and the person checks
 * it, looks at the record it produces, and saves. A transform already saved for an assignment is
 * kept when the same assignment is saved again; authoring new transforms is a later, additive step.
 */
export function MappingWizard({ step, ...target }: MappingWizardProps) {
  const t = useTranslations('dataSources');
  const id = useId();
  const screen = useMappingWizard({ ...target, step });
  const { failure, failureDetails, describeKey, wizard, isPending } = screen;

  return (
    <form
      noValidate
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        if (wizard.next === undefined) {
          screen.handleSave();
        } else {
          wizard.goNext();
        }
      }}
    >
      <Wizard
        steps={MAPPING_FORM_STEPS.map((key) => ({ key, label: t(MAPPING_STEP_LABELS[key]) }))}
        currentKey={step}
        status={
          failure === null ? undefined : (
            <MappingFailure
              id={id}
              failure={failure}
              details={failureDetails}
              describeKey={describeKey}
            />
          )
        }
        actions={
          <WizardActions
            cancelHref={dataSourceRoutes.source(target.websiteId, target.sourceId)}
            hasPrevious={wizard.previous !== undefined}
            nextLabel={
              wizard.next === undefined
                ? undefined
                : t('form.next', { step: t(MAPPING_STEP_LABELS[wizard.next]) })
            }
            saveLabel={isPending ? t('mapping.saving') : t('mapping.save')}
            isPending={isPending}
            onBack={wizard.goBack}
            onNext={wizard.goNext}
          />
        }
      >
        {step === 'fields' ? (
          <MappingFieldsStep screen={screen} />
        ) : (
          <MappingReviewStep screen={screen} />
        )}
      </Wizard>
    </form>
  );
}
