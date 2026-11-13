import { useRouter } from '@i18n';

import { locationListNavigation } from '../forms/location-list-navigation';
import { firstStepWith } from '../forms/wizard-steps';
import { bookingRoutes } from '../routes';

import { useReturnsToReview, withReviewReturn } from './use-returns-to-review';

import type { LocationDto } from '../dto/location-dto';
import type { WizardStepKey } from '../forms/wizard-steps';
import type { LocationFormValues } from '../schemas/location-schema';
import type { FieldPath, UseFormTrigger } from 'react-hook-form';

/** The fields a step shows, which are checked before the wizard moves on. */
const FIELDS_OF_STEP: Record<WizardStepKey, ReadonlyArray<FieldPath<LocationFormValues>>> = {
  basics: ['name', 'address', 'timeZone', 'isActive'],
  hours: ['openingHours.weekly'],
  exceptions: ['openingHours.exceptions'],
  services: [],
  review: [],
};

export interface WizardStepsOptions {
  readonly websiteId: string;
  /** The location being changed, or `null` while creating one. */
  readonly location: LocationDto | null;
  /** The steps this wizard walks through, in order (see `wizardStepsFor`). */
  readonly steps: readonly WizardStepKey[];
  readonly step: WizardStepKey;
  readonly trigger: UseFormTrigger<LocationFormValues>;
  readonly listOrigin?: string | undefined;
}

/**
 * Moving through the steps of the location wizard. The step lives in the address, so a step is
 * reached by navigating; the form's values stay in memory across steps. Going on checks the fields
 * of the step first.
 */
export function useWizardSteps({
  websiteId,
  location,
  steps,
  step,
  trigger,
  listOrigin,
}: WizardStepsOptions) {
  const router = useRouter();
  const index = steps.indexOf(step);
  // Opened from the review: the one way on is back to it.
  const returnsToReview = useReturnsToReview() && step !== 'review';
  const previous = returnsToReview ? undefined : steps[index - 1];
  const next = returnsToReview ? 'review' : steps[index + 1];

  const hrefOf = (key: WizardStepKey) =>
    locationListNavigation.withOrigin(
      location === null
        ? `${bookingRoutes.locationNew(websiteId)}?step=${key}`
        : `${bookingRoutes.locationEdit(websiteId, location.id, 'all')}&step=${key}`,
      listOrigin,
    );

  const reach = (key: WizardStepKey) => {
    const href = hrefOf(key);
    router.push(step === 'review' ? withReviewReturn(href) : href);
  };

  return {
    previous,
    next,
    returnsToReview,
    goTo: reach,
    goBack: () => {
      if (previous !== undefined) {
        router.push(hrefOf(previous));
      }
    },
    goNext: async () => {
      const isValid = await trigger([...FIELDS_OF_STEP[step]], { shouldFocus: true });
      if (isValid && next !== undefined) {
        router.push(hrefOf(next));
      }
    },
    /** Takes the manager to the first step that holds a field with an error, when it is not this one. */
    showFirstStepWith: (sections: ReadonlySet<string>) => {
      const first = firstStepWith(sections);
      if (first !== undefined && first !== step) {
        reach(first);
      }
    },
  };
}
