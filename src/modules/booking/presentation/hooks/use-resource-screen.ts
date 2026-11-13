'use client';

import type { SyntheticEvent } from 'react';

import { useTranslations } from '@i18n/client';

import { messagesByPath } from '../forms/field-errors';
import { resourceListNavigation } from '../forms/resource-list-navigation';
import { bookingRoutes } from '../routes';

import { useResourceForm } from './use-resource-form';
import { useResourceSteps } from './use-resource-steps';
import { useResourceSubmit } from './use-resource-submit';

import type { DayDto } from '../dto/location-dto';
import type { ResourceDto } from '../dto/resource-dto';
import type { ResourcePartKey, ResourceStepKey } from '../forms/resource-steps';
import type { ResourceFormValues } from '../schemas/resource-schema';
import type { FieldErrors } from 'react-hook-form';

export interface ResourceScreenTarget {
  readonly websiteId: string;
  readonly location: {
    readonly id: string;
    readonly name: string;
    readonly weekly: readonly DayDto[];
  };
  /** A new resource, or the one being changed. */
  readonly resource: ResourceDto | null;
  /** One part on its own, or every step in turn. */
  readonly section: ResourcePartKey | 'wizard';
  /** The wizard's current step; the page reads it from the address. */
  readonly step: ResourceStepKey;
  readonly listOrigin?: string | undefined;
}

/**
 * Everything the resource form screen needs besides its markup: the form, the wizard's steps, the
 * submission, the part shown, where Cancel goes, what Save says, and what pressing Enter or Save
 * does. A step in the wizard moves on; the last step, or a single part, saves.
 */
export function useResourceScreen({
  websiteId,
  location,
  resource,
  section,
  step,
  listOrigin,
}: ResourceScreenTarget) {
  const t = useTranslations('booking');
  const { form, initial, errorText, translateErrors } = useResourceForm(resource, location.weekly);
  const wizard = useResourceSteps({
    websiteId,
    locationId: location.id,
    resource,
    step,
    trigger: form.trigger,
    listOrigin,
  });
  const submission = useResourceSubmit({
    websiteId,
    locationId: location.id,
    resource,
    initial,
    setError: form.setError,
    onFieldErrors: wizard.showFirstStepWith,
    listOrigin,
  });
  const isWizard = section === 'wizard';

  // A field that fails the form's own check may be on a step that is not shown: go to it.
  const onInvalid = (errors: FieldErrors<ResourceFormValues>) => {
    wizard.showFirstStepWith(Object.keys(messagesByPath(errors)));
  };
  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isWizard && step !== 'review') {
      void wizard.goNext();
      return;
    }
    void form.handleSubmit(submission.submit, onInvalid)(event);
  };
  const idleSaveLabel =
    resource === null ? t('resources.form.actions.saveResource') : t('resources.form.actions.save');

  return {
    form,
    errorText,
    translateErrors,
    wizard,
    submission,
    isWizard,
    part: section === 'wizard' ? step : section,
    onSubmit,
    cancelHref:
      resource === null
        ? bookingRoutes.locationResources(websiteId, location.id)
        : resourceListNavigation.withOrigin(
            bookingRoutes.resource(websiteId, location.id, resource.id),
            listOrigin,
          ),
    saveLabel: submission.isPending ? t('resources.form.actions.saving') : idleSaveLabel,
  };
}
