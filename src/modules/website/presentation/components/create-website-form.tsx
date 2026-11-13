'use client';

import { useId } from 'react';

import { FieldMessage } from '@components/shared/field';
import { Wizard, WizardActions } from '@components/shared/wizard';

import { useTranslations } from '@i18n/client';

import { NEW_WEBSITE_STEP_LABELS, NEW_WEBSITE_STEPS } from '../forms/new-website-steps';
import { useCreateWebsiteForm } from '../hooks/use-create-website-form';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { websiteRoutes } from '../routes';

import { CreateWebsiteFormFields } from './create-website-form-fields';

import type { NewWebsiteStep } from '../forms/new-website-steps';

/** The "new website" wizard: basics, template, review. Each step lives in the address. */
export function CreateWebsiteForm({ step }: { readonly step: NewWebsiteStep }) {
  const t = useTranslations('website');
  const id = useId();
  const screen = useCreateWebsiteForm(step);
  const { wizard } = screen;

  return (
    <form noValidate aria-busy={screen.isPending} onSubmit={screen.onSubmit}>
      <Wizard
        steps={NEW_WEBSITE_STEPS.map((key) => ({ key, label: t(NEW_WEBSITE_STEP_LABELS[key]) }))}
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
            cancelHref={websiteRoutes.list()}
            hasPrevious={wizard.previous !== undefined}
            nextLabel={
              wizard.next === undefined
                ? undefined
                : t('createForm.next', { step: t(NEW_WEBSITE_STEP_LABELS[wizard.next]) })
            }
            saveLabel={screen.isPending ? t('createForm.submitting') : t('createForm.submit')}
            isPending={screen.isPending}
            onBack={wizard.goBack}
            onNext={() => {
              void wizard.goNext();
            }}
          />
        }
      >
        <CreateWebsiteFormFields key={step} id={id} step={step} screen={screen} />
      </Wizard>
    </form>
  );
}
