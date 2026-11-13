'use client';

import type { SyntheticEvent } from 'react';

import { useTranslations } from '@i18n/client';

import { messagesByPath } from '../forms/field-errors';
import { nextStepLabel } from '../forms/next-step-label';
import { serviceListNavigation } from '../forms/service-list-navigation';
import { partsOfPaths, serviceStepsFor } from '../forms/service-steps';
import { bookingRoutes } from '../routes';

import { useServiceForm } from './use-service-form';
import { useServiceSteps } from './use-service-steps';
import { useServiceSubmit } from './use-service-submit';

import type { ServiceDto } from '../dto/service-dto';
import type { ServiceStepKey } from '../forms/service-steps';
import type { ServiceFormValues } from '../schemas/service-schema';
import type { FieldErrors } from 'react-hook-form';

export interface ServiceScreenTarget {
  readonly websiteId: string;
  readonly locationId: string;
  /** A new service, or the one being changed. */
  readonly service: ServiceDto | null;
  /** One part on its own, or every step in turn. */
  readonly part: ServiceStepKey | 'wizard';
  /** Whether the location has resources: the wizard has a resources step only if so. */
  readonly hasResources: boolean;
  /** The wizard's current step as the address names it; the wizard may not have that step. */
  readonly step: ServiceStepKey;
  readonly listOrigin?: string | undefined;
}

/**
 * Everything the service form screen needs besides its markup: the form, the wizard's steps, the
 * submission, where Cancel goes, what Save says, and what pressing Enter or Save does. A step in
 * the wizard moves on; the last step, or a single part, saves.
 */
export function useServiceScreen({
  websiteId,
  locationId,
  service,
  part,
  hasResources,
  step: requestedStep,
  listOrigin,
}: ServiceScreenTarget) {
  const t = useTranslations('booking');
  const { form, initial, errorText } = useServiceForm(service);
  const steps = serviceStepsFor(hasResources);
  // An address may name a step this wizard does not have: it starts at the first.
  const step = steps.includes(requestedStep) ? requestedStep : (steps[0] ?? 'general');
  const wizard = useServiceSteps({
    websiteId,
    locationId,
    service,
    steps,
    step,
    trigger: form.trigger,
    listOrigin,
  });
  const submission = useServiceSubmit({
    websiteId,
    locationId,
    service,
    initial,
    setError: form.setError,
    onFieldErrors: wizard.showFirstStepWith,
    listOrigin,
  });
  const isWizard = part === 'wizard';

  // A field that fails the form's own check may be on a step that is not shown: go to it.
  const onInvalid = (errors: FieldErrors<ServiceFormValues>) => {
    wizard.showFirstStepWith(partsOfPaths(Object.keys(messagesByPath(errors))));
  };
  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isWizard && step !== 'review') {
      void wizard.goNext();
      return;
    }
    void form.handleSubmit(submission.submit, onInvalid)(event);
  };
  const idleSaveLabel = t(service === null ? 'services.form.saveService' : 'form.actions.save');

  const nextLabel = nextStepLabel({
    next: wizard.next,
    returnsToReview: wizard.returnsToReview,
    labelOf: (key) => t('form.actions.next', { step: t(`services.steps.${key}`) }),
    backToReview: t('form.actions.toReview'),
  });

  return {
    form,
    errorText,
    steps,
    step,
    nextLabel,
    wizard,
    submission,
    isWizard,
    onSubmit,
    cancelHref:
      service === null
        ? bookingRoutes.locationServices(websiteId, locationId)
        : serviceListNavigation.withOrigin(
            bookingRoutes.service(websiteId, locationId, service.id),
            listOrigin,
          ),
    saveLabel: submission.isPending ? t('form.actions.saving') : idleSaveLabel,
  };
}
