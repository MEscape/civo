import { useRouter } from '@i18n';

import { serviceListNavigation } from '../forms/service-list-navigation';
import { FIELDS_OF_STEP, firstStepWith } from '../forms/service-steps';
import { bookingRoutes } from '../routes';

import { useReturnsToReview, withReviewReturn } from './use-returns-to-review';

import type { ServiceDto } from '../dto/service-dto';
import type { ServiceStepKey } from '../forms/service-steps';
import type { ServiceFormValues } from '../schemas/service-schema';
import type { FieldPath, UseFormTrigger } from 'react-hook-form';

export interface ServiceStepsOptions {
  readonly websiteId: string;
  readonly locationId: string;
  /** The service being changed, or `null` while creating one. */
  readonly service: ServiceDto | null;
  /** The steps this wizard walks through, in order (see `serviceStepsFor`). */
  readonly steps: readonly ServiceStepKey[];
  readonly step: ServiceStepKey;
  readonly trigger: UseFormTrigger<ServiceFormValues>;
  readonly listOrigin?: string | undefined;
}

/**
 * Moving through the steps of the service wizard. The step lives in the address, so a step is reached
 * by navigating; the form's values stay in memory across steps. Going on checks the fields of the
 * step first.
 */
export function useServiceSteps({
  websiteId,
  locationId,
  service,
  steps,
  step,
  trigger,
  listOrigin,
}: ServiceStepsOptions) {
  const router = useRouter();
  const index = steps.indexOf(step);
  // Opened from the review: the one way on is back to it.
  const returnsToReview = useReturnsToReview() && step !== 'review';
  const previous = returnsToReview ? undefined : steps[index - 1];
  const next = returnsToReview ? 'review' : steps[index + 1];
  const reach = (key: ServiceStepKey) => {
    const href = hrefOf(key);
    router.push(step === 'review' ? withReviewReturn(href) : href);
  };

  const hrefOf = (key: ServiceStepKey) =>
    serviceListNavigation.withOrigin(
      service === null
        ? `${bookingRoutes.serviceNew(websiteId, locationId)}?step=${key}`
        : `${bookingRoutes.serviceEdit(websiteId, { locationId, serviceId: service.id }, 'all')}&step=${key}`,
      listOrigin,
    );

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
      const fields = step === 'review' ? [] : FIELDS_OF_STEP[step];
      const isValid = await trigger(fields as Array<FieldPath<ServiceFormValues>>, {
        shouldFocus: true,
      });
      if (isValid && next !== undefined) {
        router.push(hrefOf(next));
      }
    },
    /** Takes the manager to the first step that holds a field with an error, when it is not this one. */
    showFirstStepWith: (parts: ReadonlySet<string>) => {
      const first = firstStepWith(parts, steps);
      if (first !== undefined && first !== step) {
        reach(first);
      }
    },
  };
}
