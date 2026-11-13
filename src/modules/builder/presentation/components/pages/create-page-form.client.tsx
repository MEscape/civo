'use client';

import { useId } from 'react';

import { FieldMessage } from '@components/shared/field';
import { Wizard, WizardActions } from '@components/shared/wizard';

import { useTranslations } from '@i18n/client';

import { NEW_PAGE_STEP_LABELS, NEW_PAGE_STEPS } from '../../forms/new-page-steps';
import { useCreatePageForm } from '../../hooks/use-create-page-form';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { builderRoutes } from '../../routes';

import { CreatePageFormFields } from './create-page-form-fields.client';

import type { NewPageStep } from '../../forms/new-page-steps';

interface CreatePageFormProps {
  readonly websiteId: string;
  readonly step: NewPageStep;
}

/** The "new page" wizard: title and path, then review. Success opens the empty page in the editor. */
export function CreatePageForm({ websiteId, step }: CreatePageFormProps) {
  const t = useTranslations('builder');
  const id = useId();
  const screen = useCreatePageForm(websiteId, step);
  const { wizard } = screen;

  return (
    <form noValidate aria-busy={screen.isPending} onSubmit={screen.onSubmit}>
      <Wizard
        steps={NEW_PAGE_STEPS.map((key) => ({ key, label: t(NEW_PAGE_STEP_LABELS[key]) }))}
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
            cancelHref={builderRoutes.pages(websiteId)}
            hasPrevious={wizard.previous !== undefined}
            nextLabel={
              wizard.next === undefined
                ? undefined
                : t('pages.createForm.next', { step: t(NEW_PAGE_STEP_LABELS[wizard.next]) })
            }
            saveLabel={
              screen.isPending ? t('pages.createForm.submitting') : t('pages.createForm.submit')
            }
            isPending={screen.isPending}
            onBack={wizard.goBack}
            onNext={() => {
              void wizard.goNext();
            }}
          />
        }
      >
        <CreatePageFormFields key={step} id={id} step={step} screen={screen} />
      </Wizard>
    </form>
  );
}
