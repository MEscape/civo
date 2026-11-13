'use client';

import type { SyntheticEvent } from 'react';

import { useTranslations } from '@i18n/client';

import { messagesByPath, sectionsOfPaths } from '../forms/field-errors';
import { locationListNavigation } from '../forms/location-list-navigation';
import { nextStepLabel } from '../forms/next-step-label';
import { wizardStepsFor } from '../forms/wizard-steps';
import { bookingRoutes } from '../routes';

import { useLocationForm } from './use-location-form';
import { useLocationOffer } from './use-location-offer';
import { useLocationSubmit } from './use-location-submit';
import { useWizardSteps } from './use-wizard-steps';

import type { LocationDto } from '../dto/location-dto';
import type { AdoptableServiceDto } from '../dto/service-dto';
import type { WizardStepKey } from '../forms/wizard-steps';
import type { LocationFormValues } from '../schemas/location-schema';
import type { FieldErrors } from 'react-hook-form';

export interface LocationScreenTarget {
  readonly websiteId: string;
  /** A new location, or the one being changed. */
  readonly location: LocationDto | null;
  /** One part on its own, or every step in turn. */
  readonly section: WizardStepKey | 'wizard';
  /** The wizard's current step as the address names it; the wizard may not have that step. */
  readonly step: WizardStepKey;
  /** The services of other locations a new location could take over; none for one that exists. */
  readonly offered: readonly AdoptableServiceDto[];
  readonly listOrigin?: string | undefined;
}

/**
 * Everything the location form screen needs besides its markup: the form, the wizard's steps, the
 * submission, where Cancel goes, what Save says, and what pressing Enter or Save does. A step in
 * the wizard moves on; the last step, or a single section, saves.
 */
export function useLocationScreen({
  websiteId,
  location,
  section,
  step: requestedStep,
  offered,
  listOrigin,
}: LocationScreenTarget) {
  const t = useTranslations('booking');
  const { form, initial, translateErrors } = useLocationForm(location);
  const offer = useLocationOffer();
  // Only a new location takes services over, and only where there are some to take.
  const offerable = location === null ? offered : [];
  const steps = wizardStepsFor(offerable.length > 0);
  // An address may name a step this wizard does not have: it starts at the first.
  const step = steps.includes(requestedStep) ? requestedStep : (steps[0] ?? 'basics');
  const wizard = useWizardSteps({
    websiteId,
    location,
    steps,
    step,
    trigger: form.trigger,
    listOrigin,
  });
  const submission = useLocationSubmit({
    websiteId,
    location,
    initial,
    setError: form.setError,
    onFieldErrors: wizard.showFirstStepWith,
    listOrigin,
    ...(offerable.length > 0 ? { offer: { choice: offer, services: offerable } } : {}),
  });
  const isWizard = section === 'wizard';

  // A field that fails the form's own check may be on a step that is not shown: go to it.
  const onInvalid = (errors: FieldErrors<LocationFormValues>) => {
    wizard.showFirstStepWith(sectionsOfPaths(Object.keys(messagesByPath(errors))));
  };
  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isWizard && step !== 'review') {
      void wizard.goNext();
      return;
    }
    void form.handleSubmit(submission.submit, onInvalid)(event);
  };
  const idleSaveLabel = location === null ? t('form.actions.saveLocation') : t('form.actions.save');

  const nextLabel = nextStepLabel({
    next: wizard.next,
    returnsToReview: wizard.returnsToReview,
    labelOf: (key) => t('form.actions.next', { step: t(`form.steps.${key}`) }),
    backToReview: t('form.actions.toReview'),
  });

  return {
    form,
    initial,
    translateErrors,
    offer,
    offerable,
    steps,
    step,
    nextLabel,
    wizard,
    submission,
    isWizard,
    onSubmit,
    cancelHref:
      location === null
        ? bookingRoutes.locations(websiteId)
        : locationListNavigation.withOrigin(
            bookingRoutes.location(websiteId, location.id),
            listOrigin,
          ),
    saveLabel: submission.isPending ? t('form.actions.saving') : idleSaveLabel,
  };
}
