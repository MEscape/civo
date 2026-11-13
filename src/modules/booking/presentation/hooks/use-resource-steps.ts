import { useRouter } from '@i18n';

import { resourceListNavigation } from '../forms/resource-list-navigation';
import {
  FIELDS_OF_RESOURCE_STEP,
  RESOURCE_STEPS,
  firstResourceStepWith,
} from '../forms/resource-steps';
import { bookingRoutes } from '../routes';

import { useReturnsToReview, withReviewReturn } from './use-returns-to-review';

import type { ResourceDto } from '../dto/resource-dto';
import type { ResourceStepKey } from '../forms/resource-steps';
import type { ResourceFormValues } from '../schemas/resource-schema';
import type { FieldPath, UseFormTrigger } from 'react-hook-form';

export interface ResourceStepsOptions {
  readonly websiteId: string;
  readonly locationId: string;
  /** The resource being changed, or `null` while creating one. */
  readonly resource: ResourceDto | null;
  readonly step: ResourceStepKey;
  readonly trigger: UseFormTrigger<ResourceFormValues>;
  readonly listOrigin?: string | undefined;
}

/**
 * Moving through the steps of the resource wizard. The step lives in the address, so a step is
 * reached by navigating; the form's values stay in memory across steps. Going on checks the fields
 * of the step first.
 */
export function useResourceSteps({
  websiteId,
  locationId,
  resource,
  step,
  trigger,
  listOrigin,
}: ResourceStepsOptions) {
  const router = useRouter();
  const index = RESOURCE_STEPS.indexOf(step);
  // Opened from the review: the one way on is back to it.
  const returnsToReview = useReturnsToReview() && step !== 'review';
  const previous = returnsToReview ? undefined : RESOURCE_STEPS[index - 1];
  const next = returnsToReview ? 'review' : RESOURCE_STEPS[index + 1];

  const hrefOf = (key: ResourceStepKey) =>
    resourceListNavigation.withOrigin(
      resource === null
        ? `${bookingRoutes.resourceNew(websiteId, locationId)}?step=${key}`
        : `${bookingRoutes.resourceEdit(websiteId, { locationId, resourceId: resource.id }, 'all')}&step=${key}`,
      listOrigin,
    );

  const reach = (key: ResourceStepKey) => {
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
      const fields = step === 'review' ? [] : FIELDS_OF_RESOURCE_STEP[step];
      const isValid = await trigger(fields as Array<FieldPath<ResourceFormValues>>, {
        shouldFocus: true,
      });
      if (isValid && next !== undefined) {
        router.push(hrefOf(next));
      }
    },
    /** Takes the manager to the first step that holds a field with an error, when it is not this one. */
    showFirstStepWith: (paths: Iterable<string>) => {
      const first = firstResourceStepWith(paths);
      if (first !== undefined && first !== step) {
        reach(first);
      }
    },
  };
}
